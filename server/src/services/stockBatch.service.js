const { Op } = require('sequelize');

const { StockBatch, StockBalance, InventoryTransaction } = require('../models');

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

async function previewOldestFirstCost({ tenantId, siteId, itemId, storageLocationId, quantity }) {
  const batches = await StockBatch.findAll({
    where: { tenantId, siteId, itemId, storageLocationId, remainingQuantity: { [Op.gt]: 0 } },
    order: [['receivedAt', 'ASC'], ['id', 'ASC']],
  });

  let left = quantity;
  let totalCost = 0;
  for (const batch of batches) {
    if (left <= 0) break;
    const take = Math.min(Number(batch.remainingQuantity), left);
    totalCost += take * Number(batch.unitCost);
    left -= take;
  }

  if (left > 0) {
    const balance = await StockBalance.findOne({ where: { tenantId, siteId, itemId, storageLocationId } });
    totalCost += left * (balance ? Number(balance.averageUnitCost) : 0);
  }

  const total = roundMoney(totalCost);
  return { totalCost: total, unitCost: quantity > 0 ? roundMoney(total / quantity) : 0 };
}

async function latestUnitCost({ tenantId, siteId, itemId, storageLocationId }) {
  const order = [['receivedAt', 'DESC'], ['id', 'DESC']];

  const atLocation = await StockBatch.findOne({ where: { tenantId, siteId, itemId, storageLocationId }, order });
  if (atLocation) return Number(atLocation.unitCost);

  const anywhere = await StockBatch.findOne({ where: { tenantId, itemId }, order });
  if (anywhere) return Number(anywhere.unitCost);

  const lastPurchase = await InventoryTransaction.findOne({
    where: { tenantId, itemId, transactionType: 'PURCHASE_RECEIPT' },
    order: [['transactionAt', 'DESC'], ['id', 'DESC']],
  });
  if (lastPurchase) return Number(lastPurchase.unitCost);

  return 0;
}

function keyOf({ siteId, itemId, storageLocationId }) {
  return `${siteId}:${itemId}:${storageLocationId}`;
}

async function costSummaryForBalances(tenantId, balances) {
  const summaries = new Map();
  if (balances.length === 0) return summaries;

  const batches = await StockBatch.findAll({
    where: {
      tenantId,
      [Op.or]: balances.map((b) => ({ siteId: b.siteId, itemId: b.itemId, storageLocationId: b.storageLocationId })),
    },
    order: [['receivedAt', 'ASC'], ['id', 'ASC']],
  });

  const grouped = new Map();
  for (const batch of batches) {
    const key = keyOf(batch);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(batch);
  }

  for (const balance of balances) {
    const history = grouped.get(keyOf(balance)) ?? [];
    const inStock = history
      .filter((b) => Number(b.remainingQuantity) > 0)
      .map((b) => ({
        id: b.id,
        unitCost: Number(b.unitCost),
        remainingQuantity: Number(b.remainingQuantity),
        receivedQuantity: Number(b.receivedQuantity),
        receivedAt: b.receivedAt,
        sourceType: b.sourceType,
      }));

    const latest = history[history.length - 1];
    const latestUnitCostValue = latest ? Number(latest.unitCost) : null;
    let previousUnitCost = null;
    for (let i = history.length - 2; i >= 0; i -= 1) {
      if (Number(history[i].unitCost) !== latestUnitCostValue) {
        previousUnitCost = Number(history[i].unitCost);
        break;
      }
    }

    summaries.set(keyOf(balance), {
      batches: inStock,
      stockValue: roundMoney(inStock.reduce((sum, b) => sum + b.remainingQuantity * b.unitCost, 0)),
      latestUnitCost: latestUnitCostValue,
      previousUnitCost,
    });
  }

  return summaries;
}

module.exports = { previewOldestFirstCost, latestUnitCost, costSummaryForBalances, keyOf };
