const { Op } = require('sequelize');

const { sequelize, TyreFitment, TyrePurchase, TyrePurchaseItem, TyreType, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordAudit, recordCreate, recordUpdate } = require('./audit.service');
const { assertSiteAllowed } = require('./siteAccess');
const { resolveAsset } = require('./asset.service');
const { requireBusinessDate, optionalDateFilter, roundMoney, siteNamesById } = require('./fuelCommon');
const {
  siteFilter,
  meterTypeFor,
  meterUnit,
  formatReading,
  runOf,
  lockStock,
  assetsByKey,
  assetSummary,
  tyreTypeSummary,
} = require('./tyreCommon');

const repo = createTenantScopedRepository(TyreFitment);
const MAX_TYRES_PER_FITTING = 50;

const REASON_LABELS = Object.freeze({ WORN_OUT: 'Worn out', PUNCTURE: 'Puncture', DAMAGED: 'Damaged / burst', OTHER: 'Other' });

function readAssetType(value) {
  const assetType = requireText(value, 'Asset type', { max: 20 }).toUpperCase();
  if (!TyreFitment.ASSET_TYPES.includes(assetType)) throw AppError.badRequest('Asset type must be VEHICLE or MACHINERY');
  return assetType;
}

function readTyres(tyres) {
  if (!Array.isArray(tyres) || tyres.length === 0) throw AppError.badRequest('Add at least one tyre with its position');
  if (tyres.length > MAX_TYRES_PER_FITTING) throw AppError.badRequest(`You can fit at most ${MAX_TYRES_PER_FITTING} tyres at once`);
  return tyres.map((raw, index) => ({
    position: requireText(raw?.position, `Tyre ${index + 1}: position`, { max: 50 }),
    serialNumber: optionalText(raw?.serialNumber, `Tyre ${index + 1}: serial number`, { max: 64 })?.toUpperCase() ?? null,
  }));
}

function readingLabel(meterType) {
  return meterType === 'HOURS' ? 'Current Hours' : 'Current KM';
}

function formatDate(dateOnly) {
  const [y, m, d] = String(dateOnly).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function assertNotBelowPreviousReading({ tenantId, assetType, assetId, assetLabel, meterType, positions, reading, transaction }) {
  for (const position of [...new Set(positions)]) {
    const previous = await TyreFitment.findOne({
      where: { tenantId, assetType, assetId, position },
      order: [['fittedAt', 'DESC'], ['id', 'DESC']],
      transaction,
    });
    if (!previous) continue;
    const previousReading = previous.removedAt != null ? Number(previous.removeMeterReading) : Number(previous.fitMeterReading);
    if (reading < previousReading) {
      const what = previous.removedAt != null ? `removed on ${formatDate(previous.removedAt)}` : `fitted on ${formatDate(previous.fittedAt)}`;
      throw AppError.badRequest(
        `${readingLabel(meterType)} can't be lower than ${formatReading(previousReading)} ${meterUnit(meterType)}, the reading recorded for the previous ${previous.position} tyre on ${assetLabel} (${what}).`
      );
    }
  }
}

async function assertPurchasedByFittingDate({ tenantId, siteId, tyreType, fittedAt, count, transaction }) {
  const purchases = await TyrePurchase.findAll({ where: { tenantId, siteId, status: 'active' }, attributes: ['id', 'purchaseDate'], transaction });
  const purchaseDates = new Map(purchases.map((p) => [p.id, p.purchaseDate]));
  const items = purchases.length
    ? await TyrePurchaseItem.findAll({ where: { tenantId, tyreTypeId: tyreType.id, purchaseId: purchases.map((p) => p.id) }, attributes: ['purchaseId', 'quantity'], transaction })
    : [];
  const name = `${tyreType.label} ${tyreType.size}`;
  if (items.length === 0) return;

  const dates = items.map((i) => purchaseDates.get(i.purchaseId)).sort();
  const earliest = dates[0];
  if (fittedAt < earliest) {
    throw AppError.badRequest(
      `Fitting date (${formatDate(fittedAt)}) can't be before the purchase date. The ${name} tyres at this site were first purchased on ${formatDate(earliest)}.`
    );
  }

  const boughtByDate = items.filter((i) => purchaseDates.get(i.purchaseId) <= fittedAt).reduce((t, i) => t + Number(i.quantity), 0);
  const fittedByDate = await TyreFitment.count({
    where: { tenantId, siteId, tyreTypeId: tyreType.id, tyreCondition: 'new', fittedAt: { [Op.lte]: fittedAt } },
    transaction,
  });
  const availableByDate = Math.max(0, boughtByDate - fittedByDate);
  if (availableByDate < count) {
    const later = dates.find((d) => d > fittedAt);
    throw AppError.badRequest(
      `Fitting date (${formatDate(fittedAt)}) is before these tyres were purchased. Only ${availableByDate} new ${name} ${availableByDate === 1 ? 'tyre was' : 'tyres were'} in stock at this site on that date${later ? `; the next purchase is dated ${formatDate(later)}` : ''}.`
    );
  }
}

async function decorate(tenantId, fitments) {
  if (fitments.length === 0) return [];
  const [assets, types, siteNames] = await Promise.all([
    assetsByKey(tenantId, fitments),
    TyreType.findAll({ where: { tenantId, id: [...new Set(fitments.map((f) => f.tyreTypeId))] } }),
    siteNamesById(tenantId, fitments.map((f) => f.siteId)),
  ]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  return fitments.map((f) => {
    const asset = assets.get(`${f.assetType}:${f.assetId}`);
    return {
      ...f.toPublicJSON(),
      ...assetSummary(f.assetType, f.assetId, asset),
      ...tyreTypeSummary(typeById.get(f.tyreTypeId)),
      siteName: siteNames.get(f.siteId) ?? null,
      removalReasonLabel: f.removalReason ? REASON_LABELS[f.removalReason] : null,
      run: runOf(f, asset),
    };
  });
}

async function fitTyres({ tenantId, auth, actingUserId, payload }) {
  const assetType = readAssetType(payload.assetType);
  const assetId = requireText(payload.assetId, 'Asset', { max: 64 });
  const tyreTypeId = requireNumber(payload.tyreTypeId, 'Tyre type', { min: 1 });
  const condition = payload.tyreCondition === 'used' ? 'used' : 'new';
  const fittedAt = requireBusinessDate(payload.fittedAt, 'Fitting date');
  const fitMeterReading = roundMoney(requireNumber(payload.meterReading, String(payload.assetType).toUpperCase() === 'MACHINERY' ? 'Current Hours' : 'Current KM / Current Hours', { min: 0 }));
  const tyres = readTyres(payload.tyres);

  const tyreType = await TyreType.findOne({ where: { tenantId, id: tyreTypeId } });
  if (!tyreType) throw AppError.badRequest('Tyre type not found');

  const created = await sequelize.transaction(async (transaction) => {
    const asset = await resolveAsset(tenantId, assetType, assetId, { transaction, auth });
    if (asset.status !== 'active') throw AppError.badRequest('This asset is archived — tyres cannot be fitted to it');
    if (!asset.currentSiteId) {
      throw AppError.badRequest("This asset isn't assigned to a site, so there is no tyre stock to fit from. Assign it to a site first.");
    }
    if (payload.siteId !== undefined && payload.siteId !== null && payload.siteId !== '' && Number(payload.siteId) !== Number(asset.currentSiteId)) {
      throw AppError.badRequest(`This ${assetType === 'VEHICLE' ? 'vehicle' : 'machine'} isn't at the selected site. Choose one from that site.`);
    }
    const meterType = meterTypeFor(assetType, asset);
    await assertNotBelowPreviousReading({
      tenantId,
      assetType,
      assetId: asset.assetId,
      assetLabel: assetSummary(assetType, asset.assetId, asset).assetLabel,
      meterType,
      positions: tyres.map((t) => t.position),
      reading: fitMeterReading,
      transaction,
    });

    const stock = await lockStock(tenantId, asset.currentSiteId, tyreTypeId, transaction);
    if (condition === 'new') {
      await assertPurchasedByFittingDate({ tenantId, siteId: asset.currentSiteId, tyreType, fittedAt, count: tyres.length, transaction });
    }
    const available = condition === 'used' ? Number(stock.usedQuantity) : Number(stock.newQuantity);
    if (available < tyres.length) {
      const kind = condition === 'used' ? 'returned (used)' : 'new';
      throw AppError.conflict(
        `Only ${available} ${kind} ${tyreType.label} ${tyreType.size} ${available === 1 ? 'tyre is' : 'tyres are'} in stock at this asset's site. You asked for ${tyres.length}.`
      );
    }

    let newQuantity = Number(stock.newQuantity);
    let usedQuantity = Number(stock.usedQuantity);
    let stockValue = Number(stock.stockValue);
    const records = [];

    for (const tyre of tyres) {
      let unitCost = 0;
      if (condition === 'new') {
        unitCost = newQuantity === 1 ? roundMoney(stockValue) : roundMoney(stockValue / newQuantity);
        newQuantity -= 1;
        stockValue = newQuantity === 0 ? 0 : Math.max(0, roundMoney(stockValue - unitCost));
      } else {
        usedQuantity -= 1;
      }
      const record = await repo.create(
        tenantId,
        {
          siteId: asset.currentSiteId,
          tyreTypeId,
          assetType,
          assetId: asset.assetId,
          position: tyre.position,
          serialNumber: tyre.serialNumber,
          tyreCondition: condition,
          unitCost,
          meterType,
          fittedAt,
          fitMeterReading,
          createdBy: actingUserId,
          updatedBy: actingUserId,
        },
        { transaction }
      );
      await recordCreate({ tenantId, entityType: 'TyreFitment', entityId: record.id, performedBy: actingUserId, after: record }, { transaction });
      records.push(record);
    }

    await stock.update({ newQuantity, usedQuantity, stockValue }, { transaction });
    return records;
  });

  return decorate(tenantId, created);
}

async function listFitments({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, { sortableFields: ['fittedAt', 'removedAt', 'createdAt'], defaultSort: 'fittedAt:desc' });
  const and = [];
  const siteId = siteFilter(auth, query);
  if (siteId) and.push({ siteId });

  const assetType = parseEnumFilter(query.assetType, TyreFitment.ASSET_TYPES, 'Asset type');
  if (assetType) and.push({ assetType });
  if (query.assetId) and.push({ assetId: String(query.assetId) });
  if (query.tyreTypeId) and.push({ tyreTypeId: Number(query.tyreTypeId) });

  const status = parseEnumFilter(query.status, ['on', 'removed', 'scrapped', 'returned'], 'Status');
  if (status === 'on') and.push({ removedAt: null });
  if (status === 'removed') and.push({ removedAt: { [Op.ne]: null } });
  if (status === 'scrapped' || status === 'returned') and.push({ removalOutcome: status });

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom) and.push({ fittedAt: { [Op.gte]: dateFrom } });
  if (dateTo) and.push({ fittedAt: { [Op.lte]: dateTo } });

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: containsPattern(search) };
    const [vehicles, machines, types] = await Promise.all([
      Vehicle.findAll({ where: { tenantId, [Op.or]: [{ registrationNumber: like }, { assetId: like }] }, attributes: ['assetId'] }),
      Machinery.findAll({ where: { tenantId, [Op.or]: [{ rcpl: like }, { name: like }, { assetId: like }] }, attributes: ['assetId'] }),
      TyreType.findAll({ where: { tenantId, [Op.or]: [{ brand: like }, { pattern: like }, { size: like }] }, attributes: ['id'] }),
    ]);
    const options = [{ position: like }, { serialNumber: like }];
    if (vehicles.length) options.push({ assetType: 'VEHICLE', assetId: vehicles.map((v) => v.assetId) });
    if (machines.length) options.push({ assetType: 'MACHINERY', assetId: machines.map((m) => m.assetId) });
    if (types.length) options.push({ tyreTypeId: types.map((t) => t.id) });
    and.push({ [Op.or]: options });
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, {
    where: and.length ? { [Op.and]: and } : {},
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
  });
  return buildListResponse(await decorate(tenantId, rows), { page, limit, total: count });
}

async function findVisible(tenantId, auth, id, options = {}) {
  const fitment = await repo.findByPk(tenantId, id, options);
  if (!fitment) throw AppError.notFound('Tyre fitting not found');
  assertSiteAllowed(auth, fitment.siteId, 'Tyre fitting not found');
  return fitment;
}

async function removeTyre({ tenantId, auth, actingUserId, id, payload }) {
  const removedAt = requireBusinessDate(payload.removedAt, 'Removal date');
  const removeMeterReading = roundMoney(requireNumber(payload.meterReading, 'Current KM / Current Hours', { min: 0 }));
  const reason = requireText(payload.reason, 'Reason', { max: 20 }).toUpperCase();
  if (!TyreFitment.REMOVAL_REASONS.includes(reason)) {
    throw AppError.badRequest(`Reason must be one of: ${TyreFitment.REMOVAL_REASONS.join(', ')}`);
  }
  const outcome = requireText(payload.outcome, 'What happens to the tyre', { max: 20 });
  if (!TyreFitment.REMOVAL_OUTCOMES.includes(outcome)) throw AppError.badRequest('What happens to the tyre must be scrapped or returned');
  const notes = optionalText(payload.notes, 'Note', { max: 1000 });
  if (reason === 'OTHER' && !notes) throw AppError.badRequest('Add a note explaining why the tyre was removed');

  await sequelize.transaction(async (transaction) => {
    const fitment = await findVisible(tenantId, auth, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (fitment.removedAt) throw AppError.conflict('This tyre has already been removed');
    if (removedAt < fitment.fittedAt) throw AppError.badRequest(`Removal date can't be before the fitting date (${fitment.fittedAt})`);
    if (removeMeterReading < Number(fitment.fitMeterReading)) {
      throw AppError.badRequest(
        `${readingLabel(fitment.meterType)} can't be lower than ${formatReading(fitment.fitMeterReading)} ${meterUnit(fitment.meterType)}, the reading recorded when this tyre was fitted on ${formatDate(fitment.fittedAt)}.`
      );
    }

    const model = fitment.assetType === 'VEHICLE' ? Vehicle : Machinery;
    const asset = await model.findOne({ where: { tenantId, assetId: fitment.assetId }, transaction });

    const before = fitment.toJSON();
    await fitment.update(
      { removedAt, removeMeterReading, removalReason: reason, removalOutcome: outcome, removeNotes: notes, removedBy: actingUserId, updatedBy: actingUserId },
      { transaction }
    );

    if (outcome === 'returned') {
      const returnSiteId = asset?.currentSiteId ?? fitment.siteId;
      const stock = await lockStock(tenantId, returnSiteId, fitment.tyreTypeId, transaction);
      await stock.update({ usedQuantity: Number(stock.usedQuantity) + 1 }, { transaction });
    }

    await recordUpdate({ tenantId, entityType: 'TyreFitment', entityId: fitment.id, performedBy: actingUserId, before, after: fitment }, { transaction });
  });

  const [json] = await decorate(tenantId, [await repo.findByPk(tenantId, id)]);
  return json;
}

async function undoFitting({ tenantId, auth, actingUserId, id, confirmation }) {
  if (confirmation !== 'DELETE') throw AppError.badRequest('Type DELETE to confirm this action.');

  await sequelize.transaction(async (transaction) => {
    const fitment = await findVisible(tenantId, auth, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (fitment.removedAt) {
      throw AppError.conflict("This tyre has already been removed, so its fitting can't be undone.");
    }
    const stock = await lockStock(tenantId, fitment.siteId, fitment.tyreTypeId, transaction);
    if (fitment.tyreCondition === 'used') {
      await stock.update({ usedQuantity: Number(stock.usedQuantity) + 1 }, { transaction });
    } else {
      await stock.update(
        { newQuantity: Number(stock.newQuantity) + 1, stockValue: roundMoney(Number(stock.stockValue) + Number(fitment.unitCost)) },
        { transaction }
      );
    }
    await recordAudit(
      { tenantId, entityType: 'TyreFitment', entityId: fitment.id, action: 'DELETED', before: fitment.toJSON(), performedBy: actingUserId },
      { transaction }
    );
    await fitment.destroy({ transaction });
  });

  return { id: Number(id) };
}

module.exports = { REASON_LABELS, fitTyres, listFitments, removeTyre, undoFitting };
