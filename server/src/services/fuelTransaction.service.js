const { Op, Transaction } = require('sequelize');

const { sequelize, FuelTransaction, FuelStation, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordArchive, recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { resolveAsset, ASSET_TYPES } = require('./asset.service');
const { assertStationUsable } = require('./fuelStation.service');
const { postFuelMovement } = require('./fuelStock.service');
const {
  STORABLE_FUEL_TYPES,
  roundQuantity,
  roundMoney,
  requireBusinessDate,
  optionalDateFilter,
  requirePositive,
} = require('./fuelCommon');

const repo = createTenantScopedRepository(FuelTransaction);

const SORTABLE_FIELDS = ['txnDate', 'createdAt', 'quantity', 'amount'];
const DEFAULT_SORT = 'txnDate:desc';

function meterTypeFor(assetType, asset) {
  if (assetType === ASSET_TYPES.MACHINERY) return 'HOURS';
  return asset.isHoursBased ? 'HOURS' : 'KM';
}

function meterUnit(meterType) {
  return meterType === 'HOURS' ? 'hours' : 'KM';
}

function readSource(payload) {
  const source = requireText(payload.source, 'Source', { max: 20 }).toUpperCase();
  if (!FuelTransaction.SOURCES.includes(source)) {
    throw AppError.badRequest(`Source must be one of: ${FuelTransaction.SOURCES.join(', ')}`);
  }
  return source;
}

function readAssetInput(payload) {
  const assetType = requireText(payload.assetType, 'Asset type', { max: 20 }).toUpperCase();
  if (!FuelTransaction.ASSET_TYPES.includes(assetType)) {
    throw AppError.badRequest(`Asset type must be one of: ${FuelTransaction.ASSET_TYPES.join(', ')}`);
  }
  const assetId = requireText(payload.assetId, 'Asset', { max: 64 });
  return { assetType, assetId };
}

function readCommonInput(payload) {
  return {
    txnDate: requireBusinessDate(payload.txnDate, 'Date'),
    meterReading: roundMoney(requireNumber(payload.meterReading, 'Meter reading', { min: 0 })),
    notes: optionalText(payload.notes, 'Notes', { max: 2000 }),
  };
}

function readQuantity(payload) {
  return roundQuantity(requirePositive(payload.quantity, 'Quantity (litres)'));
}

async function readDirectPumpInput(tenantId, payload, { currentStationId = null } = {}) {
  const quantity = readQuantity(payload);
  const pricePerLitre = roundMoney(requirePositive(payload.pricePerLitre, 'Price per litre'));
  const fuelStationId =
    payload.fuelStationId === undefined
      ? currentStationId
      : optionalNumber(payload.fuelStationId, 'Fuel station', { min: 1 });
  if (fuelStationId != null && fuelStationId !== currentStationId) {
    await assertStationUsable(tenantId, fuelStationId);
  }
  return { quantity, pricePerLitre, amount: roundMoney(quantity * pricePerLitre), fuelStationId };
}

async function assertMeterInSequence(
  tenantId,
  { assetType, assetId, meterType, txnDate, meterReading, excludeId },
  { transaction } = {}
) {
  const base = { tenantId, assetType, assetId, meterType, status: 'active' };

  const earlier = excludeId
    ? { [Op.or]: [{ txnDate: { [Op.lt]: txnDate } }, { txnDate, id: { [Op.lt]: excludeId } }] }
    : { txnDate: { [Op.lte]: txnDate } };
  const later = excludeId
    ? { [Op.or]: [{ txnDate: { [Op.gt]: txnDate } }, { txnDate, id: { [Op.gt]: excludeId } }] }
    : { txnDate: { [Op.gt]: txnDate } };

  const [previous, next] = await Promise.all([
    FuelTransaction.findOne({
      where: { ...base, ...earlier },
      order: [['txnDate', 'DESC'], ['id', 'DESC']],
      transaction,
    }),
    FuelTransaction.findOne({
      where: { ...base, ...later },
      order: [['txnDate', 'ASC'], ['id', 'ASC']],
      transaction,
    }),
  ]);

  const unit = meterUnit(meterType);

  if (previous && meterReading < Number(previous.meterReading)) {
    throw AppError.badRequest(
      `Meter reading cannot be lower than ${Number(previous.meterReading).toLocaleString('en-IN')} ${unit}, recorded on ${previous.txnDate}`
    );
  }
  if (next && meterReading > Number(next.meterReading)) {
    throw AppError.badRequest(
      `Meter reading cannot be higher than ${Number(next.meterReading).toLocaleString('en-IN')} ${unit}, recorded on a later entry (${next.txnDate})`
    );
  }
}

async function lockAsset(asset, transaction) {
  await asset.constructor.findOne({ where: { id: asset.id }, lock: transaction.LOCK.UPDATE, transaction });
}

function assetLabelKey(assetType, assetId) {
  return `${assetType}:${assetId}`;
}

async function withLabels(tenantId, records) {
  const vehicleIds = [...new Set(records.filter((r) => r.assetType === 'VEHICLE').map((r) => r.assetId))];
  const machineIds = [...new Set(records.filter((r) => r.assetType === 'MACHINERY').map((r) => r.assetId))];
  const stationIds = [...new Set(records.map((r) => r.fuelStationId).filter((id) => id != null))];

  const [vehicles, machines, stations] = await Promise.all([
    vehicleIds.length
      ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds }, attributes: ['id', 'assetId', 'registrationNumber'] })
      : [],
    machineIds.length
      ? Machinery.findAll({
          where: { tenantId, assetId: machineIds },
          attributes: ['id', 'assetId', 'name', 'registrationNumber', 'serialNumber'],
        })
      : [],
    stationIds.length ? FuelStation.findAll({ where: { tenantId, id: stationIds }, attributes: ['id', 'stationName'] }) : [],
  ]);

  const labels = new Map();
  for (const v of vehicles) {
    labels.set(assetLabelKey('VEHICLE', v.assetId), { label: v.registrationNumber, recordId: v.id });
  }
  for (const m of machines) {
    labels.set(assetLabelKey('MACHINERY', m.assetId), {
      label: m.name || m.registrationNumber || m.serialNumber || m.assetId,
      recordId: m.id,
    });
  }
  const stationNames = new Map(stations.map((s) => [s.id, s.stationName]));

  return records.map((record) => {
    const json = record.toPublicJSON();
    const found = labels.get(assetLabelKey(record.assetType, record.assetId));
    return {
      ...json,
      assetLabel: found?.label ?? null,
      assetRecordId: found?.recordId ?? null,
      fuelStationName: stationNames.get(record.fuelStationId) ?? null,
    };
  });
}

async function listFuelTransactions({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, FuelTransaction.STATUSES, 'Status') ?? 'active';
  const where = scopeToSite({ status }, auth, 'siteId');

  const assetType = parseEnumFilter(query.assetType, FuelTransaction.ASSET_TYPES, 'Asset type');
  if (assetType) where.assetType = assetType;
  if (query.assetId) where.assetId = String(query.assetId);
  if (query.siteId && supervisorSiteId(auth) === null) where.siteId = Number(query.siteId);
  const source = parseEnumFilter(query.source, FuelTransaction.SOURCES, 'Source');
  if (source) where.source = source;
  const fuelType = parseEnumFilter(query.fuelType, FuelTransaction.FUEL_TYPES, 'Fuel type');
  if (fuelType) where.fuelType = fuelType;

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    where.txnDate = {};
    if (dateFrom) where.txnDate[Op.gte] = dateFrom;
    if (dateTo) where.txnDate[Op.lte] = dateTo;
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.assetId = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, {
    where,
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
  });

  return buildListResponse(await withLabels(tenantId, rows), { page, limit, total: count });
}

async function findVisible(tenantId, auth, id, options = {}) {
  const record = await repo.findByPk(tenantId, id, options);
  if (!record) throw AppError.notFound('Fuel transaction not found');
  assertSiteAllowed(auth, record.siteId, 'Fuel transaction not found');
  return record;
}

async function getFuelTransaction({ tenantId, auth, id }) {
  const record = await findVisible(tenantId, auth, id);
  const [json] = await withLabels(tenantId, [record]);
  return json;
}

async function createFuelTransaction({ tenantId, auth, actingUserId, payload }) {
  const source = readSource(payload);
  const { assetType, assetId } = readAssetInput(payload);
  const common = readCommonInput(payload);

  const asset = await resolveAsset(tenantId, assetType, assetId, { auth });
  if (asset.status !== 'active') {
    throw AppError.badRequest('This asset is archived — fuel cannot be recorded against it');
  }
  const meterType = meterTypeFor(assetType, asset);
  const fuelType = asset.fuelType ?? null;

  let created;

  if (source === 'SITE_STOCK') {
    const quantity = readQuantity(payload);
    if (!asset.currentSiteId) {
      throw AppError.badRequest(
        "This asset isn't at any site, so it can't be filled from site stock. Record it as a direct pump fill instead."
      );
    }
    if (!STORABLE_FUEL_TYPES.includes(fuelType)) {
      throw AppError.badRequest(
        `${fuelType ?? "This asset's fuel"} isn't kept in site stock — record it as a direct pump fill instead.`
      );
    }

    created = await sequelize.transaction(async (transaction) => {
      await lockAsset(asset, transaction);
      await assertMeterInSequence(
        tenantId,
        { assetType, assetId, meterType, txnDate: common.txnDate, meterReading: common.meterReading },
        { transaction }
      );

      const record = await repo.create(
        tenantId,
        {
          ...common,
          source,
          fuelType,
          assetType,
          assetId,
          meterType,
          quantity,
          pricePerLitre: 0,
          amount: 0,
          siteId: asset.currentSiteId,
          createdBy: actingUserId,
          updatedBy: actingUserId,
        },
        { transaction }
      );

      const ledger = await postFuelMovement({
        tenantId,
        siteId: asset.currentSiteId,
        fuelType,
        entryType: 'ISSUE',
        direction: 'OUT',
        quantity,
        entryDate: common.txnDate,
        referenceType: 'FUEL_TRANSACTION',
        referenceId: record.id,
        createdBy: actingUserId,
        transaction,
      });

      await record.update(
        { pricePerLitre: Number(ledger.unitCost), amount: Number(ledger.totalCost), ledgerEntryId: ledger.id },
        { transaction }
      );

      await recordCreate(
        { tenantId, entityType: 'FuelTransaction', entityId: record.id, performedBy: actingUserId, after: record },
        { transaction }
      );

      return record;
    });
  } else {
    const direct = await readDirectPumpInput(tenantId, payload);

    created = await sequelize.transaction(async (transaction) => {
      await lockAsset(asset, transaction);
      await assertMeterInSequence(
        tenantId,
        { assetType, assetId, meterType, txnDate: common.txnDate, meterReading: common.meterReading },
        { transaction }
      );

      const record = await repo.create(
        tenantId,
        {
          ...common,
          ...direct,
          source,
          fuelType,
          assetType,
          assetId,
          meterType,
          siteId: asset.currentSiteId ?? null,
          createdBy: actingUserId,
          updatedBy: actingUserId,
        },
        { transaction }
      );

      await recordCreate(
        { tenantId, entityType: 'FuelTransaction', entityId: record.id, performedBy: actingUserId, after: record },
        { transaction }
      );

      return record;
    });
  }

  return getFuelTransaction({ tenantId, auth, id: created.id });
}

async function updateFuelTransaction({ tenantId, auth, actingUserId, id, payload }) {
  const record = await findVisible(tenantId, auth, id);
  if (record.status !== 'active') {
    throw AppError.conflict('A deleted fuel entry cannot be edited');
  }

  const common = readCommonInput(payload);
  let changes;

  if (record.source === 'SITE_STOCK') {
    const sentQuantity = payload.quantity;
    if (
      sentQuantity !== undefined &&
      sentQuantity !== null &&
      sentQuantity !== '' &&
      roundQuantity(Number(sentQuantity)) !== Number(record.quantity)
    ) {
      throw AppError.badRequest(
        "Litres can't be changed on a fill from site stock. Delete this entry (the fuel goes back to stock) and enter it again."
      );
    }
    changes = common;
  } else {
    const direct = await readDirectPumpInput(tenantId, payload, { currentStationId: record.fuelStationId });
    changes = { ...common, ...direct };
  }

  const asset = await resolveAsset(tenantId, record.assetType, record.assetId);

  await sequelize.transaction(async (transaction) => {
    await lockAsset(asset, transaction);
    await assertMeterInSequence(
      tenantId,
      {
        assetType: record.assetType,
        assetId: record.assetId,
        meterType: record.meterType,
        txnDate: changes.txnDate,
        meterReading: changes.meterReading,
        excludeId: record.id,
      },
      { transaction }
    );

    const before = record.toJSON();
    await record.update({ ...changes, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'FuelTransaction', entityId: record.id, performedBy: actingUserId, before, after: record },
      { transaction }
    );
  });

  return getFuelTransaction({ tenantId, auth, id: record.id });
}

async function deleteFuelTransaction({ tenantId, actingUserId, id, confirmation }) {
  if (confirmation !== 'DELETE') {
    throw AppError.badRequest('Type DELETE to confirm this action.');
  }

  const archived = await sequelize.transaction(async (transaction) => {
    const record = await FuelTransaction.findOne({
      where: { tenantId, id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!record) throw AppError.notFound('Fuel transaction not found');
    if (record.status === 'archived') throw AppError.conflict('This fuel entry is already deleted');

    let reversalLedgerEntryId = null;
    if (record.source === 'SITE_STOCK' && record.siteId && record.ledgerEntryId) {
      const reversal = await postFuelMovement({
        tenantId,
        siteId: record.siteId,
        fuelType: record.fuelType,
        entryType: 'ISSUE_REVERSAL',
        direction: 'IN',
        quantity: Number(record.quantity),
        unitCost: Number(record.pricePerLitre),
        totalCost: Number(record.amount),
        entryDate: record.txnDate,
        referenceType: 'FUEL_TRANSACTION',
        referenceId: record.id,
        createdBy: actingUserId,
        transaction,
      });
      reversalLedgerEntryId = reversal.id;
    }

    await record.update(
      { status: 'archived', archivedAt: new Date(), archivedBy: actingUserId, reversalLedgerEntryId },
      { transaction }
    );

    await recordArchive(
      { tenantId, entityType: 'FuelTransaction', entityId: record.id, performedBy: actingUserId },
      { transaction }
    );

    return record;
  });

  return archived.toPublicJSON();
}

async function getFuelEfficiency({ tenantId, auth, assetType: rawAssetType, assetId }) {
  const assetType = String(rawAssetType ?? '').toUpperCase();
  const asset = await resolveAsset(tenantId, assetType, assetId, { auth });
  const meterType = meterTypeFor(assetType, asset);

  const entries = await FuelTransaction.findAll({
    where: { tenantId, assetType, assetId, meterType, status: 'active' },
    order: [['txnDate', 'ASC'], ['id', 'ASC']],
  });

  return summariseEfficiency({ assetType, assetId, meterType, entries });
}

function summariseEfficiency({ assetType, assetId, meterType, entries }) {
  const totalLitres = entries.reduce((sum, e) => sum + Number(e.quantity), 0);
  const totalCost = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  const summary = {
    assetType,
    assetId,
    meterType,
    entryCount: entries.length,
    totalLitres: roundQuantity(totalLitres),
    totalCost: roundMoney(totalCost),
    hasEnoughData: false,
  };

  if (entries.length < 2) return summary;

  const meterSpan = Number(entries[entries.length - 1].meterReading) - Number(entries[0].meterReading);
  const afterFirst = entries.slice(1);
  const litresUsed = afterFirst.reduce((sum, e) => sum + Number(e.quantity), 0);
  const costUsed = afterFirst.reduce((sum, e) => sum + Number(e.amount), 0);

  if (meterSpan <= 0 || litresUsed <= 0) return summary;

  if (meterType === 'KM') {
    return {
      ...summary,
      hasEnoughData: true,
      meterSpan: roundMoney(meterSpan),
      kmPerLitre: roundMoney(meterSpan / litresUsed),
      costPerKm: roundMoney(costUsed / meterSpan),
    };
  }

  return {
    ...summary,
    hasEnoughData: true,
    meterSpan: roundMoney(meterSpan),
    costPerHour: roundMoney(costUsed / meterSpan),
    litresPerHour: roundMoney(litresUsed / meterSpan),
  };
}

module.exports = {
  listFuelTransactions,
  getFuelTransaction,
  createFuelTransaction,
  updateFuelTransaction,
  deleteFuelTransaction,
  getFuelEfficiency,
  summariseEfficiency,
  meterTypeFor,
};
