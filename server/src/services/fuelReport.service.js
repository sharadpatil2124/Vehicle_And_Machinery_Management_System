const { Op, QueryTypes } = require('sequelize');

const { sequelize, FuelTransaction, FuelCollection, FuelStation, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { parseEnumFilter } = require('../utils/queryOptions');
const { siteScope } = require('./fuelStock.service');
const { summariseEfficiency } = require('./fuelTransaction.service');
const {
  STORABLE_FUEL_TYPES,
  roundQuantity,
  roundMoney,
  todayDateOnly,
  optionalDateFilter,
  siteNamesById,
} = require('./fuelCommon');

function readRange(query) {
  const today = todayDateOnly();
  const dateFrom = optionalDateFilter(query.dateFrom, 'From date') ?? `${today.slice(0, 8)}01`;
  const dateTo = optionalDateFilter(query.dateTo, 'To date') ?? today;
  if (dateFrom > dateTo) throw AppError.badRequest('From date must be on or before To date');
  return { dateFrom, dateTo };
}

const emptyAmount = () => ({ quantity: 0, value: 0 });

function addTo(target, quantity, value) {
  target.quantity = roundQuantity(target.quantity + Number(quantity));
  target.value = roundMoney(target.value + Number(value));
}

async function siteRegister({ tenantId, auth, query }) {
  const { dateFrom, dateTo } = readRange(query);
  const scope = siteScope(auth, query);
  const fuelType = parseEnumFilter(query.fuelType, STORABLE_FUEL_TYPES, 'Fuel type');

  const filters = ['tenant_id = :tenantId'];
  if (scope.siteId) filters.push('site_id = :siteId');
  if (fuelType) filters.push('fuel_type = :fuelType');
  const replacements = { tenantId, siteId: scope.siteId, fuelType, dateFrom, dateTo };
  const base = filters.join(' AND ');

  const [opening, movements, collections, inTransit, losses] = await Promise.all([
    sequelize.query(
      `SELECT site_id AS siteId, fuel_type AS fuelType,
              SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS quantity,
              SUM(CASE WHEN direction = 'IN' THEN total_cost ELSE -total_cost END) AS value
         FROM fuel_stock_ledger
        WHERE ${base} AND entry_date < :dateFrom
        GROUP BY site_id, fuel_type`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT site_id AS siteId, fuel_type AS fuelType, entry_type AS entryType, direction,
              SUM(quantity) AS quantity, SUM(total_cost) AS value
         FROM fuel_stock_ledger
        WHERE ${base} AND entry_date BETWEEN :dateFrom AND :dateTo
        GROUP BY site_id, fuel_type, entry_type, direction`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT site_id AS siteId, fuel_type AS fuelType, COUNT(*) AS trips,
              SUM(quantity) AS quantity, SUM(amount) AS amount
         FROM fuel_collections
        WHERE ${base} AND status <> 'cancelled' AND collection_date BETWEEN :dateFrom AND :dateTo
        GROUP BY site_id, fuel_type`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT site_id AS siteId, fuel_type AS fuelType, SUM(quantity) AS quantity
         FROM fuel_collections
        WHERE ${base} AND status = 'in_transit'
        GROUP BY site_id, fuel_type`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT site_id AS siteId, fuel_type AS fuelType,
              SUM(shortage_quantity) AS quantity, SUM(shortage_value) AS value
         FROM fuel_collections
        WHERE ${base} AND status = 'received' AND received_date BETWEEN :dateFrom AND :dateTo
        GROUP BY site_id, fuel_type`,
      { replacements, type: QueryTypes.SELECT }
    ),
  ]);

  const rows = new Map();
  const rowFor = (siteId, type) => {
    const key = `${siteId}:${type}`;
    if (!rows.has(key)) {
      rows.set(key, {
        siteId,
        fuelType: type,
        opening: emptyAmount(),
        received: emptyAmount(),
        issued: emptyAmount(),
        closing: emptyAmount(),
        collected: { trips: 0, quantity: 0, amount: 0 },
        transitLoss: emptyAmount(),
        inTransitNow: 0,
      });
    }
    return rows.get(key);
  };

  for (const r of opening) addTo(rowFor(r.siteId, r.fuelType).opening, r.quantity, r.value);
  for (const r of movements) {
    const row = rowFor(r.siteId, r.fuelType);
    if (r.entryType === 'RECEIPT') addTo(row.received, r.quantity, r.value);
    else if (r.entryType === 'ISSUE') addTo(row.issued, r.quantity, r.value);
    else if (r.entryType === 'ISSUE_REVERSAL') addTo(row.issued, -r.quantity, -r.value);
  }
  for (const r of collections) {
    const row = rowFor(r.siteId, r.fuelType);
    row.collected = {
      trips: Number(r.trips),
      quantity: roundQuantity(Number(r.quantity)),
      amount: roundMoney(Number(r.amount)),
    };
  }
  for (const r of losses) addTo(rowFor(r.siteId, r.fuelType).transitLoss, r.quantity ?? 0, r.value ?? 0);
  for (const r of inTransit) rowFor(r.siteId, r.fuelType).inTransitNow = roundQuantity(Number(r.quantity));

  for (const row of rows.values()) {
    row.closing = {
      quantity: roundQuantity(row.opening.quantity + row.received.quantity - row.issued.quantity),
      value: roundMoney(row.opening.value + row.received.value - row.issued.value),
    };
  }

  const names = await siteNamesById(tenantId, [...rows.values()].map((r) => r.siteId));
  const data = [...rows.values()]
    .map((row) => ({ ...row, siteName: names.get(row.siteId) ?? null }))
    .sort((a, b) => String(a.siteName).localeCompare(String(b.siteName)) || a.fuelType.localeCompare(b.fuelType));

  return { dateFrom, dateTo, rows: data };
}

async function assetConsumption({ tenantId, auth, query }) {
  const { dateFrom, dateTo } = readRange(query);
  const scope = siteScope(auth, query);

  const where = { tenantId, status: 'active', txnDate: { [Op.between]: [dateFrom, dateTo] } };
  if (scope.siteId) where.siteId = scope.siteId;
  const assetType = parseEnumFilter(query.assetType, FuelTransaction.ASSET_TYPES, 'Asset type');
  if (assetType) where.assetType = assetType;

  const entries = await FuelTransaction.findAll({ where, order: [['txnDate', 'ASC'], ['id', 'ASC']] });

  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.assetType}:${entry.assetId}:${entry.meterType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const vehicleIds = [...new Set(entries.filter((e) => e.assetType === 'VEHICLE').map((e) => e.assetId))];
  const machineIds = [...new Set(entries.filter((e) => e.assetType === 'MACHINERY').map((e) => e.assetId))];
  const [vehicles, machines] = await Promise.all([
    vehicleIds.length ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds }, attributes: ['assetId', 'registrationNumber', 'currentSiteId'] }) : [],
    machineIds.length ? Machinery.findAll({ where: { tenantId, assetId: machineIds }, attributes: ['assetId', 'name', 'registrationNumber', 'serialNumber', 'currentSiteId'] }) : [],
  ]);
  const labels = new Map();
  for (const v of vehicles) labels.set(`VEHICLE:${v.assetId}`, v.registrationNumber);
  for (const m of machines) labels.set(`MACHINERY:${m.assetId}`, m.name || m.registrationNumber || m.serialNumber || m.assetId);

  const rows = [...groups.values()].map((group) => {
    const first = group[0];
    const summary = summariseEfficiency({
      assetType: first.assetType,
      assetId: first.assetId,
      meterType: first.meterType,
      entries: group,
    });
    const litresFrom = (source) =>
      roundQuantity(group.filter((e) => e.source === source).reduce((sum, e) => sum + Number(e.quantity), 0));
    return {
      ...summary,
      assetLabel: labels.get(`${first.assetType}:${first.assetId}`) ?? null,
      siteStockLitres: litresFrom('SITE_STOCK'),
      directPumpLitres: litresFrom('DIRECT_PUMP'),
    };
  });

  rows.sort((a, b) => b.totalCost - a.totalCost);

  const totals = rows.reduce(
    (sum, r) => ({ litres: roundQuantity(sum.litres + r.totalLitres), cost: roundMoney(sum.cost + r.totalCost) }),
    { litres: 0, cost: 0 }
  );

  return { dateFrom, dateTo, totals, rows };
}

function summariseCollections(collections, keyOf, labelOf) {
  const groups = new Map();
  for (const c of collections) {
    const key = keyOf(c);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: labelOf(c),
        trips: 0,
        collectedQuantity: 0,
        amount: 0,
        receivedQuantity: 0,
        shortageQuantity: 0,
        shortageValue: 0,
        inTransit: 0,
      });
    }
    const g = groups.get(key);
    g.trips += 1;
    g.collectedQuantity = roundQuantity(g.collectedQuantity + Number(c.quantity));
    g.amount = roundMoney(g.amount + Number(c.amount));
    if (c.status === 'received') {
      g.receivedQuantity = roundQuantity(g.receivedQuantity + Number(c.receivedQuantity));
      g.shortageQuantity = roundQuantity(g.shortageQuantity + Number(c.shortageQuantity));
      g.shortageValue = roundMoney(g.shortageValue + Number(c.shortageValue));
    } else {
      g.inTransit += 1;
    }
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

async function collectionsSummary({ tenantId, auth, query }) {
  const { dateFrom, dateTo } = readRange(query);
  const scope = siteScope(auth, query);

  const where = { tenantId, status: { [Op.ne]: 'cancelled' }, collectionDate: { [Op.between]: [dateFrom, dateTo] } };
  if (scope.siteId) where.siteId = scope.siteId;
  const fuelType = parseEnumFilter(query.fuelType, STORABLE_FUEL_TYPES, 'Fuel type');
  if (fuelType) where.fuelType = fuelType;

  const collections = await FuelCollection.findAll({
    where,
    include: [
      { model: FuelStation, as: 'fuelStation', attributes: ['stationName'] },
      { model: Vehicle, as: 'carrierVehicle', attributes: ['assetId', 'registrationNumber'] },
    ],
  });

  const byStation = summariseCollections(collections, (c) => c.fuelStationId, (c) => c.fuelStation?.stationName ?? null);
  const byCarrier = summariseCollections(
    collections,
    (c) => c.carrierVehicleId,
    (c) => (c.carrierVehicle ? `${c.carrierVehicle.registrationNumber} (${c.carrierVehicle.assetId})` : null)
  );
  const [totals] = summariseCollections(collections, () => 'all', () => 'All');

  return {
    dateFrom,
    dateTo,
    totals: totals ?? { trips: 0, collectedQuantity: 0, amount: 0, receivedQuantity: 0, shortageQuantity: 0, shortageValue: 0, inTransit: 0 },
    byStation,
    byCarrier,
  };
}

module.exports = { siteRegister, assetConsumption, collectionsSummary };
