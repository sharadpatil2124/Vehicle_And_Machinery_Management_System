const { Op } = require('sequelize');

const { TyreFitment, TyrePurchase, TyrePurchaseItem, TyreStock, TyreType } = require('../models');
const AppError = require('../utils/AppError');
const { parseEnumFilter } = require('../utils/queryOptions');
const { optionalDateFilter, roundMoney, siteNamesById } = require('./fuelCommon');
const { siteFilter, assetsByKey, assetSummary, runOf } = require('./tyreCommon');

function readRange(query) {
  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom && dateTo && dateFrom > dateTo) throw AppError.badRequest('From date must be on or before To date');
  return { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null };
}

function dateRange(column, { dateFrom, dateTo }) {
  if (!dateFrom && !dateTo) return {};
  const range = {};
  if (dateFrom) range[Op.gte] = dateFrom;
  if (dateTo) range[Op.lte] = dateTo;
  return { [column]: range };
}

async function assetReport({ tenantId, auth, query }) {
  const range = readRange(query);
  const siteId = siteFilter(auth, query);
  const assetType = parseEnumFilter(query.assetType, TyreFitment.ASSET_TYPES, 'Asset type');

  const fitments = await TyreFitment.findAll({
    where: { tenantId, ...(siteId ? { siteId } : {}), ...(assetType ? { assetType } : {}), ...dateRange('fittedAt', range) },
    include: [{ model: TyreType, as: 'tyreType' }],
    order: [['fittedAt', 'ASC'], ['id', 'ASC']],
  });
  const assets = await assetsByKey(tenantId, fitments);
  const siteNames = await siteNamesById(tenantId, [...assets.values()].map((a) => a.currentSiteId));

  const groups = new Map();
  for (const f of fitments) {
    const key = `${f.assetType}:${f.assetId}`;
    const asset = assets.get(key);
    if (!groups.has(key)) {
      const summary = assetSummary(f.assetType, f.assetId, asset);
      groups.set(key, { ...summary, siteName: siteNames.get(summary.assetSiteId) ?? null, meterType: f.meterType, tyres: [] });
    }
    const cost = Number(f.unitCost);
    groups.get(key).tyres.push({
      id: f.id,
      position: f.position,
      serialNumber: f.serialNumber,
      tyreTypeLabel: f.tyreType?.label ?? null,
      tyreSize: f.tyreType?.size ?? null,
      tyreCondition: f.tyreCondition,
      fittedAt: f.fittedAt,
      fitMeterReading: Number(f.fitMeterReading),
      removedAt: f.removedAt,
      removeMeterReading: f.removeMeterReading == null ? null : Number(f.removeMeterReading),
      fitmentStatus: f.fitmentStatus(),
      isOnAsset: f.removedAt == null,
      meterType: f.meterType,
      run: runOf(f, asset),
      cost,
    });
  }

  const rows = [...groups.values()]
    .map((g) => {
      const tyreCost = roundMoney(g.tyres.reduce((t, x) => t + x.cost, 0));
      return {
        ...g,
        tyreCount: g.tyres.length,
        onAssetCount: g.tyres.filter((x) => x.isOnAsset).length,
        replacedCount: g.tyres.filter((x) => x.fitmentStatus === 'replaced').length,
        offAssetCount: g.tyres.filter((x) => x.fitmentStatus === 'off').length,
        tyreRun: roundMoney(g.tyres.filter((x) => x.meterType === g.meterType).reduce((t, x) => t + x.run, 0)),
        tyreCost,
      };
    })
    .sort((a, b) => b.tyreCost - a.tyreCost || String(a.assetLabel).localeCompare(String(b.assetLabel)));

  const all = rows.flatMap((r) => r.tyres);
  return {
    ...range,
    totals: {
      tyresFitted: all.length,
      onAssets: all.filter((x) => x.isOnAsset).length,
      replaced: all.filter((x) => x.fitmentStatus === 'replaced').length,
      offAsset: all.filter((x) => x.fitmentStatus === 'off').length,
      tyreCost: roundMoney(all.reduce((t, x) => t + x.cost, 0)),
    },
    rows,
  };
}

async function costReport({ tenantId, auth, query }) {
  const range = readRange(query);
  const siteId = siteFilter(auth, query);
  const siteWhere = siteId ? { siteId } : {};

  const [purchases, fitted, stocks] = await Promise.all([
    TyrePurchase.findAll({ where: { tenantId, status: 'active', ...siteWhere, ...dateRange('purchaseDate', range) } }),
    TyreFitment.findAll({ where: { tenantId, ...siteWhere, ...dateRange('fittedAt', range) } }),
    TyreStock.findAll({ where: { tenantId, ...siteWhere } }),
  ]);
  const items = purchases.length
    ? await TyrePurchaseItem.findAll({ where: { tenantId, purchaseId: purchases.map((p) => p.id) } })
    : [];

  const typeIds = [...new Set([...items, ...fitted, ...stocks].map((x) => x.tyreTypeId))];
  const types = typeIds.length ? await TyreType.findAll({ where: { tenantId, id: typeIds } }) : [];

  const byType = new Map(
    types.map((t) => [
      t.id,
      { tyreTypeId: t.id, tyreTypeLabel: t.label, tyreSize: t.size, bought: 0, purchaseCost: 0, fitted: 0, fittedCost: 0, inStock: 0, usedInStock: 0, stockValue: 0 },
    ])
  );
  for (const i of items) {
    const row = byType.get(i.tyreTypeId);
    row.bought += i.quantity;
    row.purchaseCost = roundMoney(row.purchaseCost + Number(i.lineTotal));
  }
  for (const f of fitted) {
    const row = byType.get(f.tyreTypeId);
    row.fitted += 1;
    row.fittedCost = roundMoney(row.fittedCost + Number(f.unitCost));
  }
  for (const s of stocks) {
    const row = byType.get(s.tyreTypeId);
    row.inStock += Number(s.newQuantity);
    row.usedInStock += Number(s.usedQuantity);
    row.stockValue = roundMoney(row.stockValue + Number(s.stockValue));
  }
  const typeRows = [...byType.values()]
    .filter((r) => r.bought || r.fitted || r.inStock || r.usedInStock)
    .sort((a, b) => b.purchaseCost - a.purchaseCost || a.tyreTypeLabel.localeCompare(b.tyreTypeLabel));

  const bySupplier = new Map();
  for (const p of purchases) {
    const name = p.supplierName?.trim() || null;
    const key = name ? name.toLowerCase() : 'none';
    const row = bySupplier.get(key) ?? { key, supplierName: name ?? 'No supplier', purchases: 0, tyres: 0, beforeTax: 0, tax: 0, total: 0 };
    row.purchases += 1;
    row.tyres += p.tyreCount;
    row.beforeTax = roundMoney(row.beforeTax + Number(p.subtotalAmount));
    row.tax = roundMoney(row.tax + Number(p.taxAmount));
    row.total = roundMoney(row.total + Number(p.totalAmount));
    bySupplier.set(key, row);
  }

  const sum = (list, pick) => roundMoney(list.reduce((t, x) => t + pick(x), 0));
  return {
    ...range,
    totals: {
      purchaseCost: sum(purchases, (p) => Number(p.totalAmount)),
      purchaseTax: sum(purchases, (p) => Number(p.taxAmount)),
      tyresBought: purchases.reduce((t, p) => t + p.tyreCount, 0),
      fittedCost: sum(fitted, (f) => Number(f.unitCost)),
      tyresFitted: fitted.length,
      inStock: stocks.reduce((t, s) => t + Number(s.newQuantity), 0),
      usedInStock: stocks.reduce((t, s) => t + Number(s.usedQuantity), 0),
      stockValue: sum(stocks, (s) => Number(s.stockValue)),
    },
    byType: typeRows,
    bySupplier: [...bySupplier.values()].sort((a, b) => b.total - a.total),
  };
}

module.exports = { assetReport, costReport };
