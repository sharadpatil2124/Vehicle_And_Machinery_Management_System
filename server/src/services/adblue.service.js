const { Op, Transaction, fn, col } = require('sequelize');

const { sequelize, AdBluePurchase, AdBlueFilling, Site, Vehicle, Machinery } = require('../models');
const { machineAssetIdsMatchingRcpl, vehicleAssetIdsMatchingRegistration } = require('./assetIdentifier.service');
const AppError = require('../utils/AppError');
const { requireText, requireNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordArchive, recordCreate, recordUpdate } = require('./audit.service');
const { assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { resolveAsset } = require('./asset.service');
const { roundQuantity, roundMoney, roundUnitCost, requireBusinessDate, optionalDateFilter, requirePositive, siteNamesById } = require('./fuelCommon');

const purchaseRepo = createTenantScopedRepository(AdBluePurchase);
const fillingRepo = createTenantScopedRepository(AdBlueFilling);

const MAX_LITRES = 1000000;
const MAX_RATE = 100000;

function formatLitres(value) {
  return `${Number(value).toLocaleString('en-IN')} L`;
}

function readLitres(value) {
  const litres = roundQuantity(requirePositive(value, 'Litres'));
  if (litres <= 0) throw AppError.badRequest('Litres must be greater than 0');
  if (litres > MAX_LITRES) throw AppError.badRequest(`Litres cannot be more than ${MAX_LITRES.toLocaleString('en-IN')}`);
  return litres;
}

function readRate(value) {
  const rate = roundUnitCost(requirePositive(value, 'Rate per litre'));
  if (rate <= 0) throw AppError.badRequest('Rate per litre must be greater than 0');
  if (rate > MAX_RATE) throw AppError.badRequest(`Rate per litre cannot be more than ${MAX_RATE.toLocaleString('en-IN')}`);
  return rate;
}

function readDateRange(query) {
  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom && dateTo && dateFrom > dateTo) throw AppError.badRequest('From date must be on or before To date');
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { [Op.gte]: dateFrom } : {}),
    ...(dateTo ? { [Op.lte]: dateTo } : {}),
  };
}

function visibleSiteId(auth, query) {
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) return ownSiteId;
  if (query.siteId === undefined || query.siteId === '') return null;
  return requireNumber(query.siteId, 'Site', { min: 1 });
}

function readEntrySiteId(auth, payload) {
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) return ownSiteId;
  return requireNumber(payload.siteId, 'Site', { min: 1 });
}

// Serialises every stock change at a site. It must be the first read in the transaction so the totals read after it are current.
async function lockSite(tenantId, siteId, transaction) {
  const site = await Site.findOne({ where: { tenantId, id: siteId }, transaction, lock: Transaction.LOCK.UPDATE });
  if (!site) throw AppError.badRequest('Site not found');
  return site;
}

async function lockActiveSite(tenantId, siteId, transaction) {
  const site = await lockSite(tenantId, siteId, transaction);
  if (site.status !== 'active') throw AppError.badRequest('This site is archived, so AdBlue cannot be recorded at it');
  return site;
}

async function sumBySite(model, where, transaction) {
  const rows = await model.findAll({
    where,
    attributes: ['siteId', [fn('SUM', col('quantity')), 'quantity'], [fn('SUM', col('total_cost')), 'cost'], [fn('COUNT', col('id')), 'entries']],
    group: ['siteId'],
    raw: true,
    transaction,
  });
  return new Map(rows.map((r) => [r.siteId, { quantity: roundQuantity(Number(r.quantity)), cost: roundMoney(Number(r.cost)), entries: Number(r.entries) }]));
}

const NOTHING = { quantity: 0, cost: 0, entries: 0 };

async function siteTotals(tenantId, siteId, transaction) {
  const where = { tenantId, status: 'active', ...(siteId ? { siteId } : {}) };
  const [purchased, consumed] = await Promise.all([sumBySite(AdBluePurchase, where, transaction), sumBySite(AdBlueFilling, where, transaction)]);

  return [...new Set([...purchased.keys(), ...consumed.keys()])].map((id) => {
    const bought = purchased.get(id) ?? NOTHING;
    const used = consumed.get(id) ?? NOTHING;
    return {
      siteId: id,
      purchased: { quantity: bought.quantity, cost: bought.cost },
      consumed: { quantity: used.quantity, cost: used.cost },
      remaining: { quantity: roundQuantity(bought.quantity - used.quantity), value: roundMoney(bought.cost - used.cost) },
    };
  });
}

async function stockAtSite(tenantId, siteId, transaction) {
  const [row] = await siteTotals(tenantId, siteId, transaction);
  return row?.remaining ?? { quantity: 0, value: 0 };
}

function averageRate({ quantity, value }) {
  return quantity > 0 ? roundUnitCost(value / quantity) : 0;
}

// The last litres at a site take whatever value is left, so rounding never strands paise in an empty site.
function costOfLitres(litres, stock) {
  if (roundQuantity(stock.quantity - litres) === 0) return stock.value;
  return roundMoney(litres * averageRate(stock));
}

function assertEnoughStock(litres, available) {
  if (litres > available) {
    throw AppError.conflict(`Not enough AdBlue at this site — ${formatLitres(available)} available.`);
  }
}

function assertPurchaseChangeAllowed(stock, record, nextQuantity, nextCost) {
  const remaining = roundQuantity(stock.quantity - Number(record.quantity) + nextQuantity);
  if (remaining < 0) {
    throw AppError.conflict(`AdBlue from this purchase has already been filled. Only ${formatLitres(stock.quantity)} is left at this site, so this change would take stock below zero.`);
  }
  if (roundMoney(stock.value - Number(record.totalCost) + nextCost) < 0) {
    throw AppError.conflict("Fillings have already been charged at this purchase's rate, so this change would take the stock value below zero. Delete those fillings first.");
  }
}

function assertActive(record, noun) {
  if (record.status !== 'active') throw AppError.conflict(`This ${noun} is already deleted`);
}

function assertDeleteConfirmed(confirmation) {
  if (confirmation !== 'DELETE') throw AppError.badRequest('Type DELETE to confirm this action.');
}

function readPurchaseInput(payload) {
  const quantity = readLitres(payload.quantity);
  const ratePerLitre = readRate(payload.ratePerLitre);
  return {
    supplierName: requireText(payload.supplierName, 'Supplier name', { max: 255 }),
    purchaseDate: requireBusinessDate(payload.purchaseDate, 'Purchase date'),
    quantity,
    ratePerLitre,
    totalCost: roundMoney(quantity * ratePerLitre),
  };
}

async function listPurchases({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: ['purchaseDate', 'quantity', 'totalCost'],
    defaultSort: 'purchaseDate:desc',
  });

  const where = { status: parseEnumFilter(query.status, AdBluePurchase.STATUSES, 'Status') ?? 'active' };
  const siteId = visibleSiteId(auth, query);
  if (siteId !== null) where.siteId = siteId;
  const purchaseDate = readDateRange(query);
  if (purchaseDate) where.purchaseDate = purchaseDate;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.supplierName = { [Op.like]: containsPattern(search) };

  const { rows, count } = await purchaseRepo.findAndCountAll(tenantId, { where, order, limit, offset });
  return buildListResponse(rows.map((r) => r.toPublicJSON()), { page, limit, total: count });
}

async function findVisiblePurchase(tenantId, auth, id) {
  const record = await purchaseRepo.findByPk(tenantId, id);
  if (!record) throw AppError.notFound('AdBlue purchase not found');
  assertSiteAllowed(auth, record.siteId, 'AdBlue purchase not found');
  return record;
}

async function getPurchase({ tenantId, auth, id }) {
  return (await findVisiblePurchase(tenantId, auth, id)).toPublicJSON();
}

async function createPurchase({ tenantId, auth, actingUserId, payload }) {
  const input = readPurchaseInput(payload);
  const siteId = readEntrySiteId(auth, payload);

  const record = await sequelize.transaction(async (transaction) => {
    await lockActiveSite(tenantId, siteId, transaction);
    const created = await purchaseRepo.create(tenantId, { ...input, siteId, createdBy: actingUserId, updatedBy: actingUserId }, { transaction });
    await recordCreate({ tenantId, entityType: 'AdBluePurchase', entityId: created.id, performedBy: actingUserId, after: created }, { transaction });
    return created;
  });

  return record.toPublicJSON();
}

async function updatePurchase({ tenantId, auth, actingUserId, id, payload }) {
  const { siteId } = await findVisiblePurchase(tenantId, auth, id);
  const input = readPurchaseInput(payload);

  const record = await sequelize.transaction(async (transaction) => {
    await lockSite(tenantId, siteId, transaction);
    const locked = await purchaseRepo.findByPk(tenantId, id, { transaction, lock: Transaction.LOCK.UPDATE });
    assertActive(locked, 'purchase');

    const stock = await stockAtSite(tenantId, siteId, transaction);
    assertPurchaseChangeAllowed(stock, locked, input.quantity, input.totalCost);

    const before = locked.toJSON();
    await locked.update({ ...input, updatedBy: actingUserId }, { transaction });
    await recordUpdate({ tenantId, entityType: 'AdBluePurchase', entityId: locked.id, performedBy: actingUserId, before, after: locked }, { transaction });
    return locked;
  });

  return record.toPublicJSON();
}

async function deletePurchase({ tenantId, auth, actingUserId, id, confirmation }) {
  assertDeleteConfirmed(confirmation);
  const { siteId } = await findVisiblePurchase(tenantId, auth, id);

  const record = await sequelize.transaction(async (transaction) => {
    await lockSite(tenantId, siteId, transaction);
    const locked = await purchaseRepo.findByPk(tenantId, id, { transaction, lock: Transaction.LOCK.UPDATE });
    assertActive(locked, 'purchase');

    const stock = await stockAtSite(tenantId, siteId, transaction);
    assertPurchaseChangeAllowed(stock, locked, 0, 0);

    await locked.update({ status: 'archived', archivedAt: new Date(), archivedBy: actingUserId }, { transaction });
    await recordArchive({ tenantId, entityType: 'AdBluePurchase', entityId: locked.id, performedBy: actingUserId }, { transaction });
    return locked;
  });

  return record.toPublicJSON();
}

function readFillingAsset(payload) {
  const assetType = requireText(payload.assetType, 'Asset type', { max: 20 }).toUpperCase();
  if (!AdBlueFilling.ASSET_TYPES.includes(assetType)) {
    throw AppError.badRequest(`Asset type must be one of: ${AdBlueFilling.ASSET_TYPES.join(', ')}`);
  }
  return { assetType, assetId: requireText(payload.assetId, 'Asset', { max: 64 }) };
}

async function assertAssetUsable(tenantId, auth, { assetType, assetId }) {
  const asset = await resolveAsset(tenantId, assetType, assetId, { auth });
  if (asset.status !== 'active') {
    throw AppError.badRequest('This asset is archived — AdBlue cannot be recorded against it');
  }
}

async function assetLabels(tenantId, records) {
  const idsOf = (type) => [...new Set(records.filter((r) => r.assetType === type).map((r) => r.assetId))];
  const vehicleIds = idsOf('VEHICLE');
  const machineIds = idsOf('MACHINERY');

  const [vehicles, machines] = await Promise.all([
    vehicleIds.length ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds }, attributes: ['assetId', 'registrationNumber'] }) : [],
    machineIds.length ? Machinery.findAll({ where: { tenantId, assetId: machineIds }, attributes: ['assetId', 'name', 'rcpl'] }) : [],
  ]);

  const labels = new Map();
  for (const v of vehicles) labels.set(`VEHICLE:${v.assetId}`, v.registrationNumber);
  for (const m of machines) labels.set(`MACHINERY:${m.assetId}`, Machinery.label(m));
  return labels;
}

async function fillingsWithLabels(tenantId, records) {
  const labels = await assetLabels(tenantId, records);
  return records.map((r) => ({ ...r.toPublicJSON(), assetLabel: labels.get(`${r.assetType}:${r.assetId}`) ?? null }));
}

async function listFillings({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: ['fillingDate', 'quantity', 'totalCost'],
    defaultSort: 'fillingDate:desc',
  });

  const where = { status: parseEnumFilter(query.status, AdBlueFilling.STATUSES, 'Status') ?? 'active' };
  const siteId = visibleSiteId(auth, query);
  if (siteId !== null) where.siteId = siteId;
  const assetType = parseEnumFilter(query.assetType, AdBlueFilling.ASSET_TYPES, 'Asset type');
  if (assetType) where.assetType = assetType;
  const fillingDate = readDateRange(query);
  if (fillingDate) where.fillingDate = fillingDate;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const [machineIds, vehicleIds] = await Promise.all([
      machineAssetIdsMatchingRcpl(tenantId, search),
      vehicleAssetIdsMatchingRegistration(tenantId, search),
    ]);
    where[Op.or] = [{ assetId: { [Op.like]: containsPattern(search) } }];
    if (machineIds.length) where[Op.or].push({ assetType: 'MACHINERY', assetId: machineIds });
    if (vehicleIds.length) where[Op.or].push({ assetType: 'VEHICLE', assetId: vehicleIds });
  }

  const { rows, count } = await fillingRepo.findAndCountAll(tenantId, { where, order, limit, offset });
  return buildListResponse(await fillingsWithLabels(tenantId, rows), { page, limit, total: count });
}

async function findVisibleFilling(tenantId, auth, id) {
  const record = await fillingRepo.findByPk(tenantId, id);
  if (!record) throw AppError.notFound('AdBlue filling not found');
  assertSiteAllowed(auth, record.siteId, 'AdBlue filling not found');
  return record;
}

async function getFilling({ tenantId, auth, id }) {
  const record = await findVisibleFilling(tenantId, auth, id);
  const [json] = await fillingsWithLabels(tenantId, [record]);
  return json;
}

async function createFilling({ tenantId, auth, actingUserId, payload }) {
  const asset = readFillingAsset(payload);
  const fillingDate = requireBusinessDate(payload.fillingDate, 'Filling date');
  const quantity = readLitres(payload.quantity);
  const siteId = readEntrySiteId(auth, payload);
  await assertAssetUsable(tenantId, auth, asset);

  const record = await sequelize.transaction(async (transaction) => {
    await lockActiveSite(tenantId, siteId, transaction);
    const stock = await stockAtSite(tenantId, siteId, transaction);
    assertEnoughStock(quantity, stock.quantity);

    const created = await fillingRepo.create(
      tenantId,
      {
        ...asset,
        siteId,
        fillingDate,
        quantity,
        ratePerLitre: averageRate(stock),
        totalCost: costOfLitres(quantity, stock),
        createdBy: actingUserId,
        updatedBy: actingUserId,
      },
      { transaction }
    );
    await recordCreate({ tenantId, entityType: 'AdBlueFilling', entityId: created.id, performedBy: actingUserId, after: created }, { transaction });
    return created;
  });

  return getFilling({ tenantId, auth, id: record.id });
}

// Extra litres are charged at the site's current rate; litres taken off go back at the rate this filling was charged.
function recalculateFillingCost(record, quantity, stock) {
  const currentCost = Number(record.totalCost);
  const currentRate = Number(record.ratePerLitre);
  const extra = roundQuantity(quantity - Number(record.quantity));

  if (extra === 0) return { ratePerLitre: currentRate, totalCost: currentCost };
  if (extra < 0) return { ratePerLitre: currentRate, totalCost: roundMoney(quantity * currentRate) };

  const totalCost = roundMoney(currentCost + costOfLitres(extra, stock));
  return { ratePerLitre: roundUnitCost(totalCost / quantity), totalCost };
}

async function updateFilling({ tenantId, auth, actingUserId, id, payload }) {
  const current = await findVisibleFilling(tenantId, auth, id);
  const asset = readFillingAsset(payload);
  const fillingDate = requireBusinessDate(payload.fillingDate, 'Filling date');
  const quantity = readLitres(payload.quantity);
  if (asset.assetType !== current.assetType || asset.assetId !== current.assetId) {
    await assertAssetUsable(tenantId, auth, asset);
  }

  await sequelize.transaction(async (transaction) => {
    await lockSite(tenantId, current.siteId, transaction);
    const locked = await fillingRepo.findByPk(tenantId, id, { transaction, lock: Transaction.LOCK.UPDATE });
    assertActive(locked, 'filling');

    const stock = await stockAtSite(tenantId, current.siteId, transaction);
    assertEnoughStock(quantity, roundQuantity(stock.quantity + Number(locked.quantity)));

    const before = locked.toJSON();
    await locked.update({ ...asset, fillingDate, quantity, ...recalculateFillingCost(locked, quantity, stock), updatedBy: actingUserId }, { transaction });
    await recordUpdate({ tenantId, entityType: 'AdBlueFilling', entityId: locked.id, performedBy: actingUserId, before, after: locked }, { transaction });
  });

  return getFilling({ tenantId, auth, id });
}

async function deleteFilling({ tenantId, auth, actingUserId, id, confirmation }) {
  assertDeleteConfirmed(confirmation);
  const { siteId } = await findVisibleFilling(tenantId, auth, id);

  const record = await sequelize.transaction(async (transaction) => {
    await lockSite(tenantId, siteId, transaction);
    const locked = await fillingRepo.findByPk(tenantId, id, { transaction, lock: Transaction.LOCK.UPDATE });
    assertActive(locked, 'filling');

    await locked.update({ status: 'archived', archivedAt: new Date(), archivedBy: actingUserId }, { transaction });
    await recordArchive({ tenantId, entityType: 'AdBlueFilling', entityId: locked.id, performedBy: actingUserId }, { transaction });
    return locked;
  });

  return record.toPublicJSON();
}

async function getOverview({ tenantId, auth, query }) {
  const siteId = visibleSiteId(auth, query);
  const rows = await siteTotals(tenantId, siteId);
  const names = await siteNamesById(tenantId, rows.map((r) => r.siteId));

  const sites = rows
    .map((row) => ({ ...row, siteName: names.get(row.siteId) ?? null, averageRate: averageRate(row.remaining) }))
    .sort((a, b) => String(a.siteName).localeCompare(String(b.siteName)));

  const total = (pick) => sites.reduce((sum, row) => sum + pick(row), 0);
  const consumedCost = roundMoney(total((r) => r.consumed.cost));

  return {
    totals: {
      purchased: { quantity: roundQuantity(total((r) => r.purchased.quantity)), cost: roundMoney(total((r) => r.purchased.cost)) },
      consumed: { quantity: roundQuantity(total((r) => r.consumed.quantity)), cost: consumedCost },
      remaining: { quantity: roundQuantity(total((r) => r.remaining.quantity)), value: roundMoney(total((r) => r.remaining.value)) },
      totalCost: consumedCost,
    },
    sites,
  };
}

async function getReports({ tenantId, auth, query }) {
  const siteId = visibleSiteId(auth, query);
  const dateRange = readDateRange(query);
  const base = { tenantId, status: 'active', ...(siteId !== null ? { siteId } : {}) };

  const fillingWhere = { ...base, ...(dateRange ? { fillingDate: dateRange } : {}) };
  const purchaseWhere = { ...base, ...(dateRange ? { purchaseDate: dateRange } : {}) };

  const [byAsset, consumedBySite, purchasedBySite] = await Promise.all([
    AdBlueFilling.findAll({
      where: fillingWhere,
      attributes: ['assetType', 'assetId', [fn('SUM', col('quantity')), 'quantity'], [fn('SUM', col('total_cost')), 'cost'], [fn('COUNT', col('id')), 'fills']],
      group: ['assetType', 'assetId'],
      raw: true,
    }),
    sumBySite(AdBlueFilling, fillingWhere),
    sumBySite(AdBluePurchase, purchaseWhere),
  ]);

  const labels = await assetLabels(tenantId, byAsset);
  const assetRows = byAsset
    .map((r) => ({
      assetType: r.assetType,
      assetId: r.assetId,
      assetLabel: labels.get(`${r.assetType}:${r.assetId}`) ?? null,
      fills: Number(r.fills),
      quantity: roundQuantity(Number(r.quantity)),
      cost: roundMoney(Number(r.cost)),
    }))
    .sort((a, b) => b.cost - a.cost);

  const siteIds = [...new Set([...consumedBySite.keys(), ...purchasedBySite.keys()])];
  const names = await siteNamesById(tenantId, siteIds);
  const sites = siteIds
    .map((id) => {
      const used = consumedBySite.get(id) ?? NOTHING;
      const bought = purchasedBySite.get(id) ?? NOTHING;
      return {
        siteId: id,
        siteName: names.get(id) ?? null,
        fills: used.entries,
        consumedQuantity: used.quantity,
        consumedCost: used.cost,
        purchasedQuantity: bought.quantity,
        purchasedCost: bought.cost,
      };
    })
    .sort((a, b) => b.consumedCost - a.consumedCost);

  return {
    vehicles: assetRows.filter((r) => r.assetType === 'VEHICLE'),
    machinery: assetRows.filter((r) => r.assetType === 'MACHINERY'),
    sites,
  };
}

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  listFillings,
  getFilling,
  createFilling,
  updateFilling,
  deleteFilling,
  getOverview,
  getReports,
};
