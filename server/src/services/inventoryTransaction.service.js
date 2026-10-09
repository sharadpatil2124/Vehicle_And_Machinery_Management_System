const { Op, Transaction } = require('sequelize');

const { InventoryTransaction, StockBalance, StockBatch, StockBatchMovement } = require('../models');
const AppError = require('../utils/AppError');

const TRANSACTION_NUMBER_PREFIX = 'TXN-';
const TRANSACTION_NUMBER_GENERATION_ATTEMPTS = 5;
const QUANTITY_EPSILON = 0.0005;

const BATCH_SOURCE_BY_TRANSACTION_TYPE = {
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  ISSUE_REVERSAL: 'ISSUE_REVERSAL',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER_IN: 'TRANSFER_IN',
};

const round = (value, places) => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const roundQuantity = (value) => round(value, 3);
const roundMoney = (value) => round(value, 2);

async function generateTransactionNumber(tenantId, { transaction } = {}) {
  const highest = await InventoryTransaction.max('transactionNumber', {
    where: { tenantId },
    transaction,
  });
  const nextNumber = highest ? Number(highest.slice(TRANSACTION_NUMBER_PREFIX.length)) + 1 : 1;
  return `${TRANSACTION_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isTransactionNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_inventory_transactions_tenant_number')
  );
}

async function alignBatchesWithBalance({ tenantId, key, quantityOnHand, averageCost, transaction }) {
  const batches = await StockBatch.findAll({
    where: { tenantId, ...key, remainingQuantity: { [Op.gt]: 0 } },
    order: [['receivedAt', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  const inBatches = roundQuantity(batches.reduce((sum, b) => sum + Number(b.remainingQuantity), 0));
  const gap = roundQuantity(quantityOnHand - inBatches);

  if (gap > QUANTITY_EPSILON) {
    await StockBatch.create(
      {
        tenantId,
        ...key,
        unitCost: averageCost,
        receivedQuantity: gap,
        remainingQuantity: gap,
        receivedAt: batches[0]?.receivedAt ?? new Date(),
        sourceType: 'OPENING_BALANCE',
      },
      { transaction }
    );
    return;
  }

  let excess = -gap;
  for (const batch of batches) {
    if (excess <= QUANTITY_EPSILON) break;
    const available = Number(batch.remainingQuantity);
    const take = roundQuantity(Math.min(available, excess));
    await batch.update({ remainingQuantity: roundQuantity(available - take) }, { transaction });
    excess = roundQuantity(excess - take);
  }
}

async function consumeOldestBatches({ tenantId, key, quantity, fallbackUnitCost, transaction }) {
  const batches = await StockBatch.findAll({
    where: { tenantId, ...key, remainingQuantity: { [Op.gt]: 0 } },
    order: [['receivedAt', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  const pieces = [];
  let left = quantity;
  for (const batch of batches) {
    if (left <= QUANTITY_EPSILON) break;
    const available = Number(batch.remainingQuantity);
    const take = roundQuantity(Math.min(available, left));
    if (take <= 0) continue;
    await batch.update({ remainingQuantity: roundQuantity(available - take) }, { transaction });
    pieces.push({ batch, movementType: 'CONSUME', quantity: take, unitCost: Number(batch.unitCost), receivedAt: batch.receivedAt });
    left = roundQuantity(left - take);
  }

  if (left > QUANTITY_EPSILON) {
    pieces.push({ batch: null, movementType: null, quantity: left, unitCost: fallbackUnitCost, receivedAt: new Date() });
  }

  return pieces;
}

async function restoreIntoOriginalBatches({ tenantId, quantity, reversesTransactionId, transaction }) {
  const [consumed, alreadyRestored] = await Promise.all([
    StockBatchMovement.findAll({
      where: { tenantId, inventoryTransactionId: reversesTransactionId, movementType: 'CONSUME' },
      order: [['id', 'DESC']],
      transaction,
    }),
    StockBatchMovement.findAll({
      where: { tenantId, reversesTransactionId, movementType: 'RESTORE' },
      transaction,
    }),
  ]);

  const restoredByBatch = new Map();
  for (const movement of alreadyRestored) {
    restoredByBatch.set(movement.stockBatchId, (restoredByBatch.get(movement.stockBatchId) ?? 0) + Number(movement.quantity));
  }

  const pieces = [];
  let left = quantity;
  for (const movement of consumed) {
    if (left <= QUANTITY_EPSILON) break;
    const restored = restoredByBatch.get(movement.stockBatchId) ?? 0;
    const restorable = roundQuantity(Number(movement.quantity) - restored);
    if (restorable <= 0) continue;
    const put = roundQuantity(Math.min(restorable, left));
    restoredByBatch.set(movement.stockBatchId, restored + put);

    const batch = await StockBatch.findOne({
      where: { tenantId, id: movement.stockBatchId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    await batch.update({ remainingQuantity: roundQuantity(Number(batch.remainingQuantity) + put) }, { transaction });
    pieces.push({ batch, movementType: 'RESTORE', quantity: put, unitCost: Number(batch.unitCost), receivedAt: batch.receivedAt });
    left = roundQuantity(left - put);
  }

  return { pieces, left };
}

async function createIncomingBatches({ tenantId, key, specs, sourceType, transaction }) {
  const pieces = [];
  for (const spec of specs) {
    const quantity = roundQuantity(spec.quantity);
    if (quantity <= 0) continue;
    const batch = await StockBatch.create(
      {
        tenantId,
        ...key,
        unitCost: spec.unitCost,
        receivedQuantity: quantity,
        remainingQuantity: quantity,
        receivedAt: spec.receivedAt,
        sourceType,
      },
      { transaction }
    );
    pieces.push({ batch, movementType: 'RECEIVE', quantity, unitCost: Number(spec.unitCost), receivedAt: spec.receivedAt });
  }
  return pieces;
}

async function batchStockValue({ tenantId, key, transaction }) {
  const batches = await StockBatch.findAll({
    where: { tenantId, ...key, remainingQuantity: { [Op.gt]: 0 } },
    attributes: ['remainingQuantity', 'unitCost'],
    transaction,
  });
  return batches.reduce((sum, b) => sum + Number(b.remainingQuantity) * Number(b.unitCost), 0);
}

async function postInventoryTransaction({
  tenantId,
  siteId,
  itemId,
  storageLocationId,
  uomId,
  transactionType,
  direction,
  quantity,
  unitCost = 0,
  incomingBatches = null,
  reversesTransactionId = null,
  referenceType = null,
  referenceId = null,
  transactionAt = new Date(),
  remarks = null,
  createdBy,
  transaction,
}) {
  if (direction !== 'IN' && direction !== 'OUT') {
    throw new Error(`postInventoryTransaction: direction must be "IN" or "OUT", got "${direction}"`);
  }
  if (!(quantity > 0)) {
    throw new Error('postInventoryTransaction: quantity must be a positive number');
  }

  let balance = await StockBalance.findOne({
    where: { tenantId, siteId, itemId, storageLocationId },
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  const existingQuantity = balance ? Number(balance.quantityOnHand) : 0;
  const existingAverageCost = balance ? Number(balance.averageUnitCost) : 0;
  const existingReserved = balance ? Number(balance.reservedQuantity) : 0;

  const delta = direction === 'IN' ? quantity : -quantity;
  const nextQuantity = roundQuantity(existingQuantity + delta);

  if (nextQuantity < 0) {
    throw AppError.conflict('This would take stock below zero — not enough quantity on hand.');
  }

  const key = { siteId, itemId, storageLocationId };
  await alignBatchesWithBalance({ tenantId, key, quantityOnHand: existingQuantity, averageCost: existingAverageCost, transaction });
  let pieces;

  if (direction === 'OUT') {
    pieces = await consumeOldestBatches({ tenantId, key, quantity, fallbackUnitCost: existingAverageCost, transaction });
  } else {
    pieces = [];
    let left = quantity;
    if (reversesTransactionId) {
      const restored = await restoreIntoOriginalBatches({ tenantId, quantity, reversesTransactionId, transaction });
      pieces.push(...restored.pieces);
      left = restored.left;
    }
    if (left > QUANTITY_EPSILON) {
      const specs =
        Array.isArray(incomingBatches) && incomingBatches.length > 0
          ? incomingBatches
          : [{ quantity: left, unitCost, receivedAt: transactionAt }];
      const sourceType = BATCH_SOURCE_BY_TRANSACTION_TYPE[transactionType] ?? 'ADJUSTMENT';
      pieces.push(...(await createIncomingBatches({ tenantId, key, specs, sourceType, transaction })));
    }
  }

  const totalCost = roundMoney(pieces.reduce((sum, p) => sum + p.quantity * p.unitCost, 0));
  const entryUnitCost = roundMoney(totalCost / quantity);

  const stockValue = await batchStockValue({ tenantId, key, transaction });
  const nextAverageCost = nextQuantity > 0 ? stockValue / nextQuantity : existingAverageCost;

  const balanceFields = {
    quantityOnHand: nextQuantity,
    availableQuantity: nextQuantity - existingReserved,
    averageUnitCost: nextAverageCost,
    lastTransactionAt: transactionAt,
  };

  if (balance) {
    await balance.update(balanceFields, { transaction });
  } else {
    balance = await StockBalance.create(
      { tenantId, siteId, itemId, storageLocationId, reservedQuantity: 0, ...balanceFields },
      { transaction }
    );
  }

  let created;
  for (let attempt = 1; attempt <= TRANSACTION_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
    const transactionNumber = await generateTransactionNumber(tenantId, { transaction });
    try {
      created = await InventoryTransaction.create(
        {
          tenantId,
          siteId,
          itemId,
          storageLocationId,
          transactionNumber,
          transactionType,
          quantity,
          uomId,
          unitCost: entryUnitCost,
          totalCost,
          referenceType,
          referenceId,
          transactionAt,
          remarks,
          createdBy,
        },
        { transaction }
      );
      break;
    } catch (error) {
      const isLastAttempt = attempt === TRANSACTION_NUMBER_GENERATION_ATTEMPTS;
      if (!isTransactionNumberCollision(error) || isLastAttempt) throw error;
    }
  }

  const movements = [];
  for (const piece of pieces) {
    if (!piece.batch) continue;
    if (piece.movementType === 'RECEIVE') {
      await piece.batch.update({ inventoryTransactionId: created.id }, { transaction });
    }
    movements.push({
      tenantId,
      stockBatchId: piece.batch.id,
      inventoryTransactionId: created.id,
      movementType: piece.movementType,
      quantity: piece.quantity,
      unitCost: piece.unitCost,
      reversesTransactionId: piece.movementType === 'RESTORE' ? reversesTransactionId : null,
    });
  }
  if (movements.length > 0) {
    await StockBatchMovement.bulkCreate(movements, { transaction });
  }

  created.costPieces = pieces.map((p) => ({ quantity: p.quantity, unitCost: p.unitCost, receivedAt: p.receivedAt }));
  return created;
}

module.exports = { postInventoryTransaction };
