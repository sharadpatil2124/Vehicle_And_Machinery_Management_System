const { Op } = require('sequelize');

const { sequelize, TyreFitment, TyrePurchase, TyrePurchaseItem, TyreType, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, requireIdFilter } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate, recordUpdate } = require('./audit.service');
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

function readAssetType(value) {
  const assetType = requireText(value, 'Asset type', { max: 20 }).toUpperCase();
  if (!TyreFitment.ASSET_TYPES.includes(assetType)) throw AppError.badRequest('Asset type must be VEHICLE or MACHINERY');
  return assetType;
}

function readTyres(tyres) {
  if (!Array.isArray(tyres) || tyres.length === 0) throw AppError.badRequest('Add at least one tyre with its position');
  if (tyres.length > MAX_TYRES_PER_FITTING) throw AppError.badRequest(`You can fit at most ${MAX_TYRES_PER_FITTING} tyres at once`);
  const read = tyres.map((raw, index) => ({
    position: requireText(raw?.position, `Tyre ${index + 1}: position`, { max: 50 }),
    serialNumber: optionalText(raw?.serialNumber, `Tyre ${index + 1}: serial number`, { max: 64 })?.toUpperCase() ?? null,
  }));
  const seen = new Set();
  for (const { position } of read) {
    if (seen.has(position.toLowerCase())) throw AppError.badRequest(`${position} is listed twice. Only one tyre can be active at a position.`);
    seen.add(position.toLowerCase());
  }
  return read;
}

function readingLabel(meterType) {
  return meterType === 'HOURS' ? 'Current Hours' : 'Current KM';
}

function formatDate(dateOnly) {
  const [y, m, d] = String(dateOnly).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function assertFollowsPrevious(previous, { fitmentId = null, assetLabel, meterType, fittedAt, reading }) {
  const wasTakenOff = previous.removedAt != null && (fitmentId === null || previous.replacedByFitmentId !== fitmentId);
  const previousDate = wasTakenOff ? previous.removedAt : previous.fittedAt;
  const previousReading = Number(wasTakenOff ? previous.removeMeterReading : previous.fitMeterReading);
  const event = wasTakenOff ? 'taken off' : 'fitted';
  if (fittedAt < previousDate) {
    throw AppError.badRequest(`Fitting date (${formatDate(fittedAt)}) can't be before ${formatDate(previousDate)}, when the previous ${previous.position} tyre on ${assetLabel} was ${event}.`);
  }
  if (reading < previousReading) {
    throw AppError.badRequest(
      `${readingLabel(meterType)} can't be lower than ${formatReading(previousReading)} ${meterUnit(meterType)}, the reading recorded for the previous ${previous.position} tyre on ${assetLabel} (${event} on ${formatDate(previousDate)}).`
    );
  }
}

async function assertFollowPreviousTyres({ tenantId, assetType, assetId, assetLabel, meterType, positions, fittedAt, reading, transaction }) {
  for (const position of positions) {
    const previous = await TyreFitment.findOne({
      where: { tenantId, assetType, assetId, position },
      order: [['fittedAt', 'DESC'], ['id', 'DESC']],
      transaction,
    });
    if (previous) assertFollowsPrevious(previous, { assetLabel, meterType, fittedAt, reading });
  }
}

async function assertFitsPositionHistory({ tenantId, assetType, assetId, assetLabel, meterType, position, fittedAt, reading, fitmentId, checkNextDate, transaction }) {
  const others = await TyreFitment.findAll({
    where: { tenantId, assetType, assetId, position, id: { [Op.ne]: fitmentId } },
    order: [['fittedAt', 'ASC'], ['id', 'ASC']],
    transaction,
  });
  const isEarlier = (f) => f.fittedAt < fittedAt || (f.fittedAt === fittedAt && f.id < fitmentId);
  const previous = others.filter(isEarlier).at(-1);
  if (previous) assertFollowsPrevious(previous, { fitmentId, assetLabel, meterType, fittedAt, reading });
  const next = others.find((f) => !isEarlier(f));
  if (!next) return;
  if (checkNextDate && next.fittedAt > fittedAt) {
    throw AppError.badRequest(`Fitting date (${formatDate(fittedAt)}) can't be before ${formatDate(next.fittedAt)}, when a later ${next.position} tyre on ${assetLabel} was fitted.`);
  }
  if (reading > Number(next.fitMeterReading)) {
    throw AppError.badRequest(
      `${readingLabel(meterType)} can't be higher than ${formatReading(next.fitMeterReading)} ${meterUnit(meterType)}, the reading recorded for the next ${next.position} tyre on ${assetLabel} (fitted on ${formatDate(next.fittedAt)}).`
    );
  }
}

function findActiveTyre({ tenantId, assetType, assetId, position, exceptId = null, transaction }) {
  return TyreFitment.findOne({
    where: { tenantId, assetType, assetId, position, removedAt: null, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function takeOffReplacedTyre(active, { fittedAt, reading, actingUserId, transaction }) {
  const before = active.toJSON();
  await active.update({ removedAt: fittedAt, removeMeterReading: reading, removedBy: actingUserId, updatedBy: actingUserId }, { transaction });
  return before;
}

async function linkReplacement(replaced, before, replacementId, { tenantId, actingUserId, transaction }) {
  await replaced.update({ replacedByFitmentId: replacementId }, { transaction });
  await recordUpdate({ tenantId, entityType: 'TyreFitment', entityId: replaced.id, performedBy: actingUserId, before, after: replaced }, { transaction });
}

async function assertPurchasedByFittingDate({ tenantId, siteId, tyreType, fittedAt, count, excludeFitmentId = null, transaction }) {
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
    where: { tenantId, siteId, tyreTypeId: tyreType.id, tyreCondition: 'new', fittedAt: { [Op.lte]: fittedAt }, ...(excludeFitmentId ? { id: { [Op.ne]: excludeFitmentId } } : {}) },
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

  const replacedIds = new Map();
  const created = await sequelize.transaction(async (transaction) => {
    const asset = await resolveAsset(tenantId, assetType, assetId, { transaction, auth, lock: transaction.LOCK.UPDATE });
    if (asset.status !== 'active') throw AppError.badRequest('This asset is archived — tyres cannot be fitted to it');
    if (!asset.currentSiteId) {
      throw AppError.badRequest("This asset isn't assigned to a site, so there is no tyre stock to fit from. Assign it to a site first.");
    }
    if (payload.siteId !== undefined && payload.siteId !== null && payload.siteId !== '' && Number(payload.siteId) !== Number(asset.currentSiteId)) {
      throw AppError.badRequest(`This ${assetType === 'VEHICLE' ? 'vehicle' : 'machine'} isn't at the selected site. Choose one from that site.`);
    }
    const meterType = meterTypeFor(assetType, asset);
    await assertFollowPreviousTyres({
      tenantId,
      assetType,
      assetId: asset.assetId,
      assetLabel: assetSummary(assetType, asset.assetId, asset).assetLabel,
      meterType,
      positions: tyres.map((t) => t.position),
      fittedAt,
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
      const active = await findActiveTyre({ tenantId, assetType, assetId: asset.assetId, position: tyre.position, transaction });
      const activeBefore = active ? await takeOffReplacedTyre(active, { fittedAt, reading: fitMeterReading, actingUserId, transaction }) : null;
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
      if (active) {
        await linkReplacement(active, activeBefore, record.id, { tenantId, actingUserId, transaction });
        replacedIds.set(record.id, active.id);
      }
      records.push(record);
    }

    await stock.update({ newQuantity, usedQuantity, stockValue }, { transaction });
    return records;
  });

  const rows = await decorate(tenantId, created);
  return rows.map((row) => ({ ...row, replacedFitmentId: replacedIds.get(row.id) ?? null }));
}

async function listFitments({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, { sortableFields: ['fittedAt', 'createdAt'], defaultSort: 'fittedAt:desc' });
  const and = [];
  const siteId = siteFilter(auth, query);
  if (siteId) and.push({ siteId });

  const assetType = parseEnumFilter(query.assetType, TyreFitment.ASSET_TYPES, 'Asset type');
  if (assetType) and.push({ assetType });
  if (query.assetId) and.push({ assetId: String(query.assetId) });
  if (query.tyreTypeId) and.push({ tyreTypeId: requireIdFilter(query.tyreTypeId, 'Tyre type') });

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

async function swapStockForType({ tenantId, fitment, tyreType, transaction }) {
  const [firstId, secondId] = [fitment.tyreTypeId, tyreType.id].sort((a, b) => a - b);
  const first = await lockStock(tenantId, fitment.siteId, firstId, transaction);
  const second = await lockStock(tenantId, fitment.siteId, secondId, transaction);
  const [oldStock, newStock] = firstId === fitment.tyreTypeId ? [first, second] : [second, first];

  if (fitment.tyreCondition === 'used') {
    if (Number(newStock.usedQuantity) < 1) {
      throw AppError.conflict(`No returned (used) ${tyreType.label} ${tyreType.size} tyres are in stock at this fitting's site.`);
    }
    await newStock.update({ usedQuantity: Number(newStock.usedQuantity) - 1 }, { transaction });
    await oldStock.update({ usedQuantity: Number(oldStock.usedQuantity) + 1 }, { transaction });
    return 0;
  }

  const quantity = Number(newStock.newQuantity);
  const value = Number(newStock.stockValue);
  if (quantity < 1) {
    throw AppError.conflict(`No new ${tyreType.label} ${tyreType.size} tyres are in stock at this fitting's site.`);
  }
  const unitCost = quantity === 1 ? roundMoney(value) : roundMoney(value / quantity);
  await newStock.update({ newQuantity: quantity - 1, stockValue: quantity === 1 ? 0 : Math.max(0, roundMoney(value - unitCost)) }, { transaction });
  await oldStock.update(
    { newQuantity: Number(oldStock.newQuantity) + 1, stockValue: roundMoney(Number(oldStock.stockValue) + Number(fitment.unitCost)) },
    { transaction }
  );
  return unitCost;
}

async function updateFitment({ tenantId, auth, actingUserId, id, payload }) {
  const assetType = readAssetType(payload.assetType);
  const assetId = requireText(payload.assetId, 'Asset', { max: 64 });
  const tyreTypeId = requireNumber(payload.tyreTypeId, 'Tyre type', { min: 1 });
  const position = requireText(payload.position, 'Position', { max: 50 });
  const serialNumber = optionalText(payload.serialNumber, 'Serial number', { max: 64 })?.toUpperCase() ?? null;
  const fittedAt = requireBusinessDate(payload.fittedAt, 'Fitting date');
  const fitMeterReading = roundMoney(requireNumber(payload.meterReading, assetType === 'MACHINERY' ? 'Current Hours' : 'Current KM / Current Hours', { min: 0 }));

  const current = await findVisible(tenantId, auth, id);

  await sequelize.transaction(async (transaction) => {
    const assetKeys = [[current.assetType, current.assetId], [assetType, assetId]].sort((a, b) => a.join().localeCompare(b.join()));
    let asset = null;
    for (const [keyType, keyId] of assetKeys) {
      const locked = await resolveAsset(tenantId, keyType, keyId, { transaction, lock: transaction.LOCK.UPDATE });
      if (keyType === assetType && keyId === assetId) asset = locked;
    }

    const fitment = await findVisible(tenantId, auth, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (fitment.removedAt) throw AppError.conflict("This tyre is no longer on the asset, so its fitting can't be edited.");
    if (fitment.assetType !== current.assetType || fitment.assetId !== current.assetId) {
      throw AppError.conflict('This fitting was just changed by someone else. Reload the page and try again.');
    }

    const tyreType = await TyreType.findOne({ where: { tenantId, id: tyreTypeId }, transaction });
    if (!tyreType) throw AppError.badRequest('Tyre type not found');

    const assetChanged = assetType !== fitment.assetType || asset.assetId !== fitment.assetId;
    const typeChanged = tyreType.id !== fitment.tyreTypeId;
    const dateChanged = fittedAt !== fitment.fittedAt;
    const readingChanged = fitMeterReading !== Number(fitment.fitMeterReading);
    const positionChanged = position !== fitment.position;
    const movedPosition = assetChanged || position.toLowerCase() !== fitment.position.toLowerCase();
    if (!assetChanged && !typeChanged && !dateChanged && !readingChanged && !positionChanged && serialNumber === fitment.serialNumber) return;

    if (assetChanged) {
      assertSiteAllowed(auth, asset.currentSiteId, 'Asset not found');
      if (asset.status !== 'active') throw AppError.badRequest('This asset is archived — tyres cannot be fitted to it');
      if (Number(asset.currentSiteId) !== fitment.siteId) {
        throw AppError.badRequest(`This ${assetType === 'VEHICLE' ? 'vehicle' : 'machine'} isn't at the site this tyre came from. Choose one from that site.`);
      }
    }
    const meterType = assetChanged ? meterTypeFor(assetType, asset) : fitment.meterType;

    if (movedPosition || dateChanged || readingChanged) {
      await assertFitsPositionHistory({
        tenantId,
        assetType,
        assetId: asset.assetId,
        assetLabel: assetSummary(assetType, asset.assetId, asset).assetLabel,
        meterType,
        position,
        fittedAt,
        reading: fitMeterReading,
        fitmentId: fitment.id,
        checkNextDate: movedPosition || dateChanged,
        transaction,
      });
    }
    const unitCost = typeChanged ? await swapStockForType({ tenantId, fitment, tyreType, transaction }) : Number(fitment.unitCost);
    if (fitment.tyreCondition === 'new' && (typeChanged || dateChanged)) {
      await assertPurchasedByFittingDate({ tenantId, siteId: fitment.siteId, tyreType, fittedAt, count: 1, excludeFitmentId: fitment.id, transaction });
    }

    const replacedByThis = await TyreFitment.findOne({ where: { tenantId, replacedByFitmentId: fitment.id }, transaction, lock: transaction.LOCK.UPDATE });
    const occupant = movedPosition ? await findActiveTyre({ tenantId, assetType, assetId: asset.assetId, position, exceptId: fitment.id, transaction }) : null;
    const occupantBefore = occupant ? await takeOffReplacedTyre(occupant, { fittedAt, reading: fitMeterReading, actingUserId, transaction }) : null;

    const before = fitment.toJSON();
    await fitment.update(
      { assetType, assetId: asset.assetId, tyreTypeId: tyreType.id, position, serialNumber, unitCost, meterType, fittedAt, fitMeterReading, updatedBy: actingUserId },
      { transaction }
    );
    await fitment.reload({ transaction });
    await recordUpdate({ tenantId, entityType: 'TyreFitment', entityId: fitment.id, performedBy: actingUserId, before, after: fitment }, { transaction });
    if (occupant) await linkReplacement(occupant, occupantBefore, fitment.id, { tenantId, actingUserId, transaction });

    if (replacedByThis && (movedPosition || dateChanged || readingChanged)) {
      const replacedBefore = replacedByThis.toJSON();
      await replacedByThis.update(
        movedPosition
          ? { removedAt: null, removeMeterReading: null, removedBy: null, replacedByFitmentId: null, updatedBy: actingUserId }
          : { removedAt: fittedAt, removeMeterReading: fitMeterReading, updatedBy: actingUserId },
        { transaction }
      );
      await recordUpdate({ tenantId, entityType: 'TyreFitment', entityId: replacedByThis.id, performedBy: actingUserId, before: replacedBefore, after: replacedByThis }, { transaction });
    }
  });

  const [json] = await decorate(tenantId, [await repo.findByPk(tenantId, id)]);
  return json;
}

module.exports = { fitTyres, listFitments, updateFitment };
