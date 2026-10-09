const { Transaction, Op, fn, col } = require('sequelize');

const { SiteFuelStock, FuelStockLedger, FuelCollection, FuelTransaction } = require('../models');
const AppError = require('../utils/AppError');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { supervisorSiteId } = require('./siteAccess');
const {
  STORABLE_FUEL_TYPES,
  roundQuantity,
  roundMoney,
  roundUnitCost,
  optionalDateFilter,
  siteNamesById,
} = require('./fuelCommon');

function siteScope(auth, query) {
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) return { siteId: ownSiteId };
  if (query.siteId) return { siteId: Number(query.siteId) };
  return {};
}

async function lockSiteStock({ tenantId, siteId, fuelType, transaction }) {
  const where = { tenantId, siteId, fuelType };
  const existing = await SiteFuelStock.findOne({ where, transaction, lock: Transaction.LOCK.UPDATE });
  if (existing) return existing;

  try {
    return await SiteFuelStock.create({ ...where, quantityOnHand: 0, stockValue: 0, averageCost: 0 }, { transaction });
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') throw error;
    return SiteFuelStock.findOne({ where, transaction, lock: Transaction.LOCK.UPDATE });
  }
}

async function postFuelMovement({
  tenantId,
  siteId,
  fuelType,
  entryType,
  direction,
  quantity,
  unitCost,
  totalCost: totalCostOverride,
  entryDate,
  referenceType,
  referenceId,
  createdBy,
  transaction,
}) {
  if (direction !== 'IN' && direction !== 'OUT') {
    throw new Error(`postFuelMovement: direction must be "IN" or "OUT", got "${direction}"`);
  }
  if (!(quantity > 0)) {
    throw new Error('postFuelMovement: quantity must be a positive number');
  }

  const stock = await lockSiteStock({ tenantId, siteId, fuelType, transaction });
  const onHand = Number(stock.quantityOnHand);
  const value = Number(stock.stockValue);
  const average = Number(stock.averageCost);

  let entryUnitCost;
  let entryTotalCost;
  let nextQuantity;
  let nextValue;
  let nextAverage = average;

  if (direction === 'OUT') {
    if (roundQuantity(onHand - quantity) < 0) {
      throw AppError.conflict(
        `Not enough ${fuelType} in this site's stock — ${onHand.toLocaleString('en-IN')} L available.`
      );
    }
    nextQuantity = roundQuantity(onHand - quantity);
    entryUnitCost = average;
    entryTotalCost = nextQuantity === 0 ? value : roundMoney(quantity * average);
    nextValue = nextQuantity === 0 ? 0 : roundMoney(value - entryTotalCost);
  } else {
    entryUnitCost = roundUnitCost(unitCost ?? average);
    entryTotalCost = totalCostOverride != null ? roundMoney(totalCostOverride) : roundMoney(quantity * entryUnitCost);
    nextQuantity = roundQuantity(onHand + quantity);
    nextValue = roundMoney(value + entryTotalCost);
    nextAverage = roundUnitCost(nextValue / nextQuantity);
  }

  await stock.update(
    { quantityOnHand: nextQuantity, stockValue: nextValue, averageCost: nextAverage, lastMovementAt: new Date() },
    { transaction }
  );

  return FuelStockLedger.create(
    {
      tenantId,
      siteId,
      fuelType,
      entryType,
      direction,
      quantity: roundQuantity(quantity),
      unitCost: entryUnitCost,
      totalCost: entryTotalCost,
      balanceQuantity: nextQuantity,
      balanceValue: nextValue,
      entryDate,
      referenceType,
      referenceId,
      createdBy,
    },
    { transaction }
  );
}

async function listSiteFuelStock({ tenantId, auth, query }) {
  const where = { tenantId, ...siteScope(auth, query) };
  const fuelType = parseEnumFilter(query.fuelType, STORABLE_FUEL_TYPES, 'Fuel type');
  if (fuelType) where.fuelType = fuelType;

  const [stocks, inTransit] = await Promise.all([
    SiteFuelStock.findAll({ where }),
    FuelCollection.findAll({
      where: { ...where, status: 'in_transit' },
      attributes: ['siteId', 'fuelType', [fn('SUM', col('quantity')), 'litres'], [fn('COUNT', col('id')), 'trips']],
      group: ['siteId', 'fuelType'],
      raw: true,
    }),
  ]);

  const rows = new Map();
  const keyOf = (siteId, type) => `${siteId}:${type}`;
  for (const stock of stocks) {
    rows.set(keyOf(stock.siteId, stock.fuelType), {
      ...stock.toPublicJSON(),
      inTransitQuantity: 0,
      inTransitCollections: 0,
    });
  }
  for (const transit of inTransit) {
    const key = keyOf(transit.siteId, transit.fuelType);
    const row = rows.get(key) ?? {
      id: null,
      siteId: transit.siteId,
      fuelType: transit.fuelType,
      quantityOnHand: 0,
      stockValue: 0,
      averageCost: 0,
      lastMovementAt: null,
    };
    rows.set(key, { ...row, inTransitQuantity: roundQuantity(Number(transit.litres)), inTransitCollections: Number(transit.trips) });
  }

  const names = await siteNamesById(tenantId, [...rows.values()].map((r) => r.siteId));
  const data = [...rows.values()]
    .map((row) => ({ ...row, siteName: names.get(row.siteId) ?? null }))
    .sort((a, b) => String(a.siteName).localeCompare(String(b.siteName)) || a.fuelType.localeCompare(b.fuelType));

  return { data };
}

async function referenceLabels(tenantId, entries) {
  const idsOf = (type) => entries.filter((e) => e.referenceType === type).map((e) => e.referenceId);
  const [collections, issues] = await Promise.all([
    FuelCollection.findAll({ where: { tenantId, id: idsOf('FUEL_COLLECTION') }, attributes: ['id', 'collectionNumber'] }),
    FuelTransaction.findAll({ where: { tenantId, id: idsOf('FUEL_TRANSACTION') }, attributes: ['id', 'assetType', 'assetId'] }),
  ]);

  const labels = new Map();
  for (const c of collections) labels.set(`FUEL_COLLECTION:${c.id}`, c.collectionNumber);
  for (const t of issues) labels.set(`FUEL_TRANSACTION:${t.id}`, t.assetId);
  return labels;
}

async function listFuelLedger({ tenantId, auth, query }) {
  const { page, limit, offset } = parseListQuery(query, { sortableFields: ['id'], defaultSort: 'id:desc' });

  const where = { ...siteScope(auth, query) };
  const fuelType = parseEnumFilter(query.fuelType, STORABLE_FUEL_TYPES, 'Fuel type');
  if (fuelType) where.fuelType = fuelType;
  const entryType = parseEnumFilter(query.entryType, FuelStockLedger.ENTRY_TYPES, 'Entry type');
  if (entryType) where.entryType = entryType;

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) where.entryDate[Op.gte] = dateFrom;
    if (dateTo) where.entryDate[Op.lte] = dateTo;
  }

  const { rows, count } = await FuelStockLedger.findAndCountAll({
    where: { ...where, tenantId },
    order: [['id', 'DESC']],
    limit,
    offset,
  });

  const [labels, names] = await Promise.all([
    referenceLabels(tenantId, rows),
    siteNamesById(tenantId, rows.map((r) => r.siteId)),
  ]);

  const data = rows.map((row) => ({
    ...row.toPublicJSON(),
    siteName: names.get(row.siteId) ?? null,
    referenceLabel: labels.get(`${row.referenceType}:${row.referenceId}`) ?? null,
  }));

  return buildListResponse(data, { page, limit, total: count });
}

module.exports = { lockSiteStock, postFuelMovement, listSiteFuelStock, listFuelLedger, siteScope };
