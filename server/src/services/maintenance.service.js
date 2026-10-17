const { Op, Transaction } = require('sequelize');

const { sequelize, Maintenance, Vehicle, Machinery } = require('../models');
const { machineAssetIdsMatchingRcpl, vehicleAssetIdsMatchingRegistration } = require('./assetIdentifier.service');
const AppError = require('../utils/AppError');
const { requireText, optionalText, optionalNumber } = require('../utils/validation');
const { assertMeterNotDecreasing } = require('../utils/meter');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordArchive, recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { resolveAsset, ASSET_TYPES } = require('./asset.service');
const { roundMoney, optionalDateFilter } = require('./fuelCommon');
const { AUDIT_ENTITY_FOR_ASSET, meterFields, lockAsset } = require('./assetMeter.service');

const repo = createTenantScopedRepository(Maintenance);

const SORTABLE_FIELDS = ['reportedAt', 'completedAt', 'downtimeMinutes', 'totalCost', 'createdAt'];
const DEFAULT_SORT = 'reportedAt:desc';

const NOT_FOUND = 'Maintenance record not found';
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const DUE_SOON_THRESHOLD = Object.freeze({ KM: 1000, HOURS: 50 });

const NEXT_STAGE = Object.freeze({ reported: 'in_progress', in_progress: 'resolved' });
const STAGE_LABEL = Object.freeze({ reported: 'reported', in_progress: 'in progress', resolved: 'resolved' });

const toNumber = (value) => (value == null ? null : Number(value));

function assetLabel(assetType, asset) {
  if (assetType === ASSET_TYPES.VEHICLE) return asset.registrationNumber;
  return Machinery.label(asset);
}

function readAssetInput(payload) {
  const assetType = requireText(payload.assetType, 'Asset type', { max: 20 }).toUpperCase();
  if (!Maintenance.ASSET_TYPES.includes(assetType)) {
    throw AppError.badRequest(`Asset type must be one of: ${Maintenance.ASSET_TYPES.join(', ')}`);
  }
  return { assetType, assetId: requireText(payload.assetId, 'Asset', { max: 64 }) };
}

function readType(value) {
  const type = requireText(value, 'Maintenance type', { max: 20 }).toLowerCase();
  if (!Maintenance.TYPES.includes(type)) {
    throw AppError.badRequest(`Maintenance type must be one of: ${Maintenance.TYPES.join(', ')}`);
  }
  return type;
}

function readTimestamp(value, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw AppError.badRequest(`${label} is required`);
    return null;
  }
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`${label} must be a valid date and time`);
  }
  if (date.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw AppError.badRequest(`${label} cannot be in the future`);
  }
  return date;
}

function readMoney(value, label) {
  const amount = optionalNumber(value, label, { min: 0 });
  return amount == null ? null : roundMoney(amount);
}

function readCosts(payload, existing = {}) {
  const costs = {};
  if (payload.labourCost !== undefined) costs.labourCost = readMoney(payload.labourCost, 'Labour cost');
  if (payload.totalCost !== undefined) costs.totalCost = readMoney(payload.totalCost, 'Total cost');

  const labourCost = 'labourCost' in costs ? costs.labourCost : toNumber(existing.labourCost);
  const totalCost = 'totalCost' in costs ? costs.totalCost : toNumber(existing.totalCost);
  if (labourCost != null && totalCost != null && totalCost < labourCost) {
    throw AppError.badRequest('Total cost cannot be less than the labour cost');
  }
  return costs;
}

function assertTimeline({ reportedAt, startedAt, completedAt }) {
  if (startedAt && new Date(startedAt) < new Date(reportedAt)) {
    throw AppError.badRequest('Work cannot start before the maintenance was reported');
  }
  if (completedAt && new Date(completedAt) < new Date(startedAt ?? reportedAt)) {
    throw AppError.badRequest('Completion cannot be before work started');
  }
}

function breakdownDowntime(type, reportedAt, completedAt) {
  if (type !== 'breakdown' || !completedAt) return null;
  return Maintenance.minutesBetween(reportedAt, completedAt);
}

function openWhere(tenantId, assetType, assetId, type) {
  return { tenantId, assetType, assetId, type, status: 'active', stage: { [Op.ne]: 'resolved' } };
}

function labelKey(assetType, assetId) {
  return `${assetType}:${assetId}`;
}

async function withLabels(tenantId, records) {
  const idsOf = (assetType) => [...new Set(records.filter((r) => r.assetType === assetType).map((r) => r.assetId))];
  const vehicleIds = idsOf(ASSET_TYPES.VEHICLE);
  const machineIds = idsOf(ASSET_TYPES.MACHINERY);

  const [vehicles, machines] = await Promise.all([
    vehicleIds.length
      ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds }, attributes: ['id', 'assetId', 'registrationNumber'] })
      : [],
    machineIds.length
      ? Machinery.findAll({
          where: { tenantId, assetId: machineIds },
          attributes: ['id', 'assetId', 'name', 'rcpl'],
        })
      : [],
  ]);

  const labels = new Map();
  for (const v of vehicles) labels.set(labelKey(ASSET_TYPES.VEHICLE, v.assetId), { label: assetLabel(ASSET_TYPES.VEHICLE, v), recordId: v.id });
  for (const m of machines) labels.set(labelKey(ASSET_TYPES.MACHINERY, m.assetId), { label: assetLabel(ASSET_TYPES.MACHINERY, m), recordId: m.id });

  return records.map((record) => {
    const found = labels.get(labelKey(record.assetType, record.assetId));
    return { ...record.toPublicJSON(), assetLabel: found?.label ?? null, assetRecordId: found?.recordId ?? null };
  });
}

function startOfLocalDay(dateOnly) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

async function listMaintenance({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Maintenance.STATUSES, 'Status') ?? 'active';
  const where = scopeToSite({ status }, auth, 'siteId');

  const type = parseEnumFilter(query.type, Maintenance.TYPES, 'Maintenance type');
  if (type) where.type = type;
  const stage = parseEnumFilter(query.stage, Maintenance.STAGES, 'Stage');
  if (stage) where.stage = stage;
  else if (query.open === 'true') where.stage = { [Op.ne]: 'resolved' };

  const assetType = parseEnumFilter(query.assetType, Maintenance.ASSET_TYPES, 'Asset type');
  if (assetType) where.assetType = assetType;
  if (query.assetId) where.assetId = String(query.assetId);
  if (query.siteId && supervisorSiteId(auth) === null) where.siteId = Number(query.siteId);

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    where.reportedAt = {};
    if (dateFrom) where.reportedAt[Op.gte] = startOfLocalDay(dateFrom);
    if (dateTo) {
      const dayAfter = startOfLocalDay(dateTo);
      dayAfter.setDate(dayAfter.getDate() + 1);
      where.reportedAt[Op.lt] = dayAfter;
    }
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search && !query.assetId) {
    const [machineIds, vehicleIds] = await Promise.all([
      machineAssetIdsMatchingRcpl(tenantId, search),
      vehicleAssetIdsMatchingRegistration(tenantId, search),
    ]);
    where[Op.or] = [{ assetId: { [Op.like]: `%${search}%` } }];
    if (machineIds.length) where[Op.or].push({ assetType: ASSET_TYPES.MACHINERY, assetId: machineIds });
    if (vehicleIds.length) where[Op.or].push({ assetType: ASSET_TYPES.VEHICLE, assetId: vehicleIds });
  }

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
  if (!record) throw AppError.notFound(NOT_FOUND);
  assertSiteAllowed(auth, record.siteId, NOT_FOUND);
  return record;
}

async function getMaintenance({ tenantId, auth, id }) {
  const record = await findVisible(tenantId, auth, id);
  const [json] = await withLabels(tenantId, [record]);
  return json;
}

async function getPreventiveSchedule({ tenantId, auth }) {
  const assetWhere = scopeToSite({ tenantId, status: 'active' }, auth);

  const [vehicles, machines, openWork] = await Promise.all([
    Vehicle.findAll({ where: assetWhere }),
    Machinery.findAll({ where: assetWhere }),
    Maintenance.findAll({
      where: scopeToSite({ tenantId, type: 'preventive', status: 'active', stage: { [Op.ne]: 'resolved' } }, auth, 'siteId'),
      attributes: ['id', 'assetType', 'assetId', 'stage'],
    }),
  ]);

  const openByAsset = openWorkByAsset(openWork);

  const build = (assetType, assets) =>
    assets
      .map((asset) => scheduleEntry(assetType, asset, openByAsset))
      .filter(Boolean)
      .sort((a, b) => a.remaining - b.remaining);

  return {
    dueSoonThreshold: DUE_SOON_THRESHOLD,
    vehicles: build(ASSET_TYPES.VEHICLE, vehicles),
    machinery: build(ASSET_TYPES.MACHINERY, machines),
  };
}

function openWorkByAsset(openWork) {
  return new Map(openWork.map((m) => [labelKey(m.assetType, m.assetId), { id: m.id, stage: m.stage }]));
}

function scheduleEntry(assetType, asset, openByAsset) {
  const fields = meterFields(assetType, asset);
  const currentReading = toNumber(asset[fields.current]);
  const nextServiceAt = toNumber(asset[fields.next]);
  if (currentReading == null || nextServiceAt == null) return null;

  const remaining = roundMoney(nextServiceAt - currentReading);
  let state = 'ok';
  if (remaining <= 0) state = 'overdue';
  else if (remaining <= DUE_SOON_THRESHOLD[fields.meterType]) state = 'due_soon';

  return {
    assetType,
    assetId: asset.assetId,
    assetRecordId: asset.id,
    assetLabel: assetLabel(assetType, asset),
    siteId: asset.currentSiteId,
    meterType: fields.meterType,
    currentReading,
    serviceInterval: toNumber(asset[fields.interval]),
    nextServiceAt,
    remaining,
    state,
    openMaintenance: openByAsset.get(labelKey(assetType, asset.assetId)) ?? null,
  };
}

const SCHEDULE_SQL = {
  [ASSET_TYPES.VEHICLE]: {
    model: Vehicle,
    remaining: `CASE WHEN type = ${sequelize.escape(Vehicle.HOURS_BASED_TYPE)} THEN next_service_hours - current_hours ELSE next_service_km - current_km END`,
    dueSoon: `CASE WHEN type = ${sequelize.escape(Vehicle.HOURS_BASED_TYPE)} THEN ${DUE_SOON_THRESHOLD.HOURS} ELSE ${DUE_SOON_THRESHOLD.KM} END`,
  },
  [ASSET_TYPES.MACHINERY]: {
    model: Machinery,
    remaining: 'next_service_hours - current_hours',
    dueSoon: String(DUE_SOON_THRESHOLD.HOURS),
  },
};

const SCHEDULE_VIEWS = ['attention', 'all'];

async function listPreventiveSchedule({ tenantId, auth, query }) {
  const assetType = parseEnumFilter(String(query.assetType ?? '').toUpperCase(), Maintenance.ASSET_TYPES, 'Asset type');
  if (!assetType) throw AppError.badRequest('Asset type is required');
  const view = parseEnumFilter(query.view, SCHEDULE_VIEWS, 'View') ?? 'attention';
  const { page, limit, offset } = parseListQuery(query, { sortableFields: [], defaultSort: 'id:asc' });

  const { model, remaining, dueSoon } = SCHEDULE_SQL[assetType];
  const conditions = [scopeToSite({ tenantId, status: 'active' }, auth), sequelize.literal(`(${remaining}) IS NOT NULL`)];
  if (view === 'attention') conditions.push(sequelize.literal(`(${remaining}) <= (${dueSoon})`));

  const { rows, count } = await model.findAndCountAll({
    where: { [Op.and]: conditions },
    order: [[sequelize.literal(`(${remaining})`), 'ASC'], ['id', 'ASC']],
    limit,
    offset,
  });

  const openWork = rows.length
    ? await Maintenance.findAll({
        where: scopeToSite(
          { tenantId, type: 'preventive', status: 'active', stage: { [Op.ne]: 'resolved' }, assetType, assetId: rows.map((r) => r.assetId) },
          auth,
          'siteId'
        ),
        attributes: ['id', 'assetType', 'assetId', 'stage'],
      })
    : [];
  const openByAsset = openWorkByAsset(openWork);

  const entries = rows.map((asset) => scheduleEntry(assetType, asset, openByAsset)).filter(Boolean);
  return { ...buildListResponse(entries, { page, limit, total: count }), dueSoonThreshold: DUE_SOON_THRESHOLD };
}

async function createMaintenance({ tenantId, auth, actingUserId, payload }) {
  const { assetType, assetId } = readAssetInput(payload);
  const type = readType(payload.type);
  const input = {
    description: requireText(payload.description, 'Description', { max: 2000 }),
    reportedAt: readTimestamp(payload.reportedAt, 'Reported at') ?? new Date(),
    performedBy: optionalText(payload.performedBy, 'Performed by', { max: 150 }),
    meterReading: readMoney(payload.meterReading, 'Meter reading'),
    ...readCosts(payload),
  };

  const asset = await resolveAsset(tenantId, assetType, assetId, { auth });
  if (asset.status !== 'active') {
    throw AppError.badRequest('This asset is archived — maintenance cannot be recorded against it');
  }
  const { meterType } = meterFields(assetType, asset);

  const created = await sequelize.transaction(async (transaction) => {
    await lockAsset(asset, transaction);

    const open = await Maintenance.findOne({ where: openWhere(tenantId, assetType, assetId, type), transaction });
    if (open) {
      throw AppError.conflict(
        type === 'breakdown'
          ? 'This asset already has an open breakdown — resolve it before reporting another'
          : 'This asset already has open preventive maintenance — complete it before scheduling another'
      );
    }

    const record = await repo.create(
      tenantId,
      {
        ...input,
        assetType,
        assetId,
        type,
        stage: 'reported',
        meterType,
        siteId: asset.currentSiteId ?? null,
        createdBy: actingUserId,
        updatedBy: actingUserId,
      },
      { transaction }
    );

    await recordCreate(
      { tenantId, entityType: 'Maintenance', entityId: record.id, performedBy: actingUserId, after: record },
      { transaction }
    );

    return record;
  });

  return getMaintenance({ tenantId, auth, id: created.id });
}

async function updateMaintenance({ tenantId, auth, actingUserId, id, payload }) {
  const record = await findVisible(tenantId, auth, id);
  if (record.status !== 'active') {
    throw AppError.conflict('A deleted maintenance record cannot be edited');
  }
  if (payload.stage !== undefined && payload.stage !== record.stage) {
    throw AppError.badRequest('The stage can only be changed by starting or resolving the work');
  }

  const changes = readCosts(payload, record);
  if (payload.description !== undefined) {
    changes.description = requireText(payload.description, 'Description', { max: 2000 });
  }
  if (payload.performedBy !== undefined) {
    changes.performedBy = optionalText(payload.performedBy, 'Performed by', { max: 150 });
  }
  if (payload.meterReading !== undefined) {
    const meterReading = readMoney(payload.meterReading, 'Meter reading');
    const locksMeter = record.type === 'preventive' && record.stage === 'resolved';
    if (locksMeter && meterReading !== toNumber(record.meterReading)) {
      throw AppError.badRequest(
        "The meter reading of completed preventive maintenance can't be changed — it has already updated the asset's service schedule"
      );
    }
    changes.meterReading = meterReading;
  }

  if (payload.reportedAt !== undefined) {
    changes.reportedAt = readTimestamp(payload.reportedAt, 'Reported at', { required: true });
  }
  if (payload.startedAt !== undefined) {
    if (record.stage === 'reported') {
      throw AppError.badRequest("Work hasn't started yet — start the work to record its start time");
    }
    changes.startedAt = readTimestamp(payload.startedAt, 'Started at', { required: true });
  }
  if (payload.completedAt !== undefined) {
    if (record.stage !== 'resolved') {
      throw AppError.badRequest("This maintenance isn't resolved yet — resolve it to record its completion time");
    }
    changes.completedAt = readTimestamp(payload.completedAt, 'Completed at', { required: true });
  }

  const timeline = {
    reportedAt: changes.reportedAt ?? record.reportedAt,
    startedAt: changes.startedAt ?? record.startedAt,
    completedAt: changes.completedAt ?? record.completedAt,
  };
  assertTimeline(timeline);
  if (record.stage === 'resolved') {
    changes.downtimeMinutes = breakdownDowntime(record.type, timeline.reportedAt, timeline.completedAt);
  }

  await sequelize.transaction(async (transaction) => {
    const before = record.toJSON();
    await record.update({ ...changes, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'Maintenance', entityId: record.id, performedBy: actingUserId, before, after: record },
      { transaction }
    );
  });

  return getMaintenance({ tenantId, auth, id: record.id });
}

async function applyPreventiveCompletion({ tenantId, record, meterReading, actingUserId, transaction }) {
  const asset = await resolveAsset(tenantId, record.assetType, record.assetId, { transaction });
  const locked = await lockAsset(asset, transaction);
  const fields = meterFields(record.assetType, locked);

  if (fields.meterType !== record.meterType) {
    throw AppError.conflict(
      "This asset's meter basis has changed since the maintenance was scheduled — delete this record and schedule it again"
    );
  }

  const reading = assertMeterNotDecreasing(locked[fields.current] ?? 0, meterReading, fields.unit);
  const interval = toNumber(locked[fields.interval]);

  const before = locked.toJSON();
  const assetChanges = { [fields.current]: reading, updatedBy: actingUserId };
  if (interval != null) assetChanges[fields.next] = roundMoney(reading + interval);

  await locked.update(assetChanges, { transaction });
  await recordUpdate(
    {
      tenantId,
      entityType: AUDIT_ENTITY_FOR_ASSET[record.assetType],
      entityId: locked.id,
      performedBy: actingUserId,
      before,
      after: locked,
    },
    { transaction }
  );
}

async function changeStage({ tenantId, auth, actingUserId, id, payload }) {
  const target = requireText(payload.stage, 'Stage', { max: 20 }).toLowerCase();
  if (!Maintenance.STAGES.includes(target)) {
    throw AppError.badRequest(`Stage must be one of: ${Maintenance.STAGES.join(', ')}`);
  }
  const at = readTimestamp(payload.at, target === 'resolved' ? 'Completed at' : 'Started at') ?? new Date();

  await findVisible(tenantId, auth, id);

  await sequelize.transaction(async (transaction) => {
    const record = await Maintenance.findOne({ where: { tenantId, id }, lock: Transaction.LOCK.UPDATE, transaction });
    if (record.status !== 'active') {
      throw AppError.conflict('A deleted maintenance record cannot change stage');
    }

    const expected = NEXT_STAGE[record.stage];
    if (target !== expected) {
      throw AppError.conflict(
        expected
          ? `Maintenance that is ${STAGE_LABEL[record.stage]} can only move to ${STAGE_LABEL[expected]}`
          : 'This maintenance is already resolved — its stage can no longer change'
      );
    }

    const changes = { stage: target, ...readCosts(payload, record) };
    if (payload.performedBy !== undefined) {
      changes.performedBy = optionalText(payload.performedBy, 'Performed by', { max: 150 });
    }

    if (target === 'in_progress') {
      assertTimeline({ reportedAt: record.reportedAt, startedAt: at });
      changes.startedAt = at;
    } else {
      assertTimeline({ reportedAt: record.reportedAt, startedAt: record.startedAt, completedAt: at });
      changes.completedAt = at;
      changes.downtimeMinutes = breakdownDowntime(record.type, record.reportedAt, at);

      const sentReading = readMoney(payload.meterReading, 'Meter reading');
      const meterReading = sentReading ?? toNumber(record.meterReading);
      if (record.type === 'preventive') {
        if (meterReading == null) {
          throw AppError.badRequest('Enter the meter reading at which the preventive maintenance was completed');
        }
        await applyPreventiveCompletion({ tenantId, record, meterReading, actingUserId, transaction });
      }
      changes.meterReading = meterReading;
    }

    const before = record.toJSON();
    await record.update({ ...changes, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'Maintenance', entityId: record.id, performedBy: actingUserId, before, after: record },
      { transaction }
    );
  });

  return getMaintenance({ tenantId, auth, id });
}

async function deleteMaintenance({ tenantId, actingUserId, id, confirmation }) {
  if (confirmation !== 'DELETE') {
    throw AppError.badRequest('Type DELETE to confirm this action.');
  }

  const archived = await sequelize.transaction(async (transaction) => {
    const record = await Maintenance.findOne({ where: { tenantId, id }, lock: Transaction.LOCK.UPDATE, transaction });
    if (!record) throw AppError.notFound(NOT_FOUND);
    if (record.status === 'archived') throw AppError.conflict('This maintenance record is already deleted');

    await record.update({ status: 'archived', archivedAt: new Date(), archivedBy: actingUserId }, { transaction });
    await recordArchive(
      { tenantId, entityType: 'Maintenance', entityId: record.id, performedBy: actingUserId },
      { transaction }
    );
    return record;
  });

  return archived.toPublicJSON();
}

module.exports = {
  listMaintenance,
  getMaintenance,
  getPreventiveSchedule,
  listPreventiveSchedule,
  createMaintenance,
  updateMaintenance,
  changeStage,
  deleteMaintenance,
};
