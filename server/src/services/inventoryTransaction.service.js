const { Transaction } = require('sequelize');

const { InventoryTransaction, StockBalance } = require('../models');
const AppError = require('../utils/AppError');

const TRANSACTION_NUMBER_PREFIX = 'TXN-';
const TRANSACTION_NUMBER_GENERATION_ATTEMPTS = 5;

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
  const nextQuantity = existingQuantity + delta;

  if (nextQuantity < 0) {
    throw AppError.conflict('This would take stock below zero — not enough quantity on hand.');
  }

  const nextAverageCost =
    direction === 'IN' && nextQuantity > 0
      ? (existingQuantity * existingAverageCost + quantity * unitCost) / nextQuantity
      : existingAverageCost;

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
          unitCost,
          totalCost: quantity * unitCost,
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

  return created;
}

module.exports = { postInventoryTransaction };
