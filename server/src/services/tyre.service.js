const { Op } = require('sequelize');

const { sequelize, Tyre, TyreAssignment, Vehicle, Site } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');
const { supervisorSiteId } = require('./siteAccess');
const { requireBusinessDate, optionalDateFilter, roundMoney, siteNamesById } = require('./fuelCommon');
const { positionsForVehicle, findPosition, ALL_POSITION_LABELS } = require('../config/tyrePositions');

const repo = createTenantScopedRepository(Tyre);
const assignmentRepo = createTenantScopedRepository(TyreAssignment);

const SORTABLE_FIELDS = ['tyreCode', 'createdAt', 'brand', 'size', 'purchaseDate'];
const DEFAULT_SORT = 'tyreCode:desc';

const FITMENT_SORTABLE_FIELDS = ['installedAt', 'removedAt', 'createdAt'];
const FITMENT_DEFAULT_SORT = 'installedAt:desc';

const TYRE_CODE_PREFIX = 'TYR-';
const TYRE_CODE_GENERATION_ATTEMPTS = 5;

const REMOVAL_REASON_LABELS = Object.freeze({
  WORN_OUT: 'Worn out',
  PUNCTURE: 'Puncture',
  DAMAGED: 'Damaged / burst',
  ROTATION: 'Rotation',
  RETREADING: 'Sent for retreading',
  OTHER: 'Other',
});

const NOT_FOUND = 'Tyre not found';

function meterTypeFor(vehicle) {
  return vehicle.isHoursBased ? 'HOURS' : 'KM';
}

function meterUnit(meterType) {
  return meterType === 'HOURS' ? 'hours' : 'KM';
}

function readingFor(vehicle, meterType) {
  const value = meterType === 'HOURS' ? vehicle?.currentHours : vehicle?.currentKM;
  return value == null ? null : Number(value);
}

function formatReading(value) {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function runningFor(assignment, vehicle) {
  const end =
    assignment.removedAt != null
      ? Number(assignment.removeMeterReading)
      : readingFor(vehicle, assignment.meterType);
  if (end == null) return 0;
  return Math.max(0, roundMoney(end - Number(assignment.installMeterReading)));
}

function positionLabel(vehicle, code) {
  if (vehicle) {
    const found = findPosition(vehicle, code);
    if (found) return found.label;
  }
  return ALL_POSITION_LABELS[code] ?? code;
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return requireBusinessDate(value, label);
}

function readCondition(value) {
  if (value === undefined || value === null || value === '') return 'new';
  if (!Tyre.CONDITIONS.includes(value)) {
    throw AppError.badRequest(`Condition must be one of: ${Tyre.CONDITIONS.join(', ')}`);
  }
  return value;
}

function readTyreInput(payload, { partial = false } = {}) {
  const input = {};
  const has = (key) => !partial || payload[key] !== undefined;

  if (has('brand')) input.brand = requireText(payload.brand, 'Brand', { max: 100 });
  if (has('modelName')) input.modelName = optionalText(payload.modelName, 'Model / pattern', { max: 100 });
  if (has('size')) input.size = requireText(payload.size, 'Size', { max: 50 }).toUpperCase();
  if (has('serialNumber')) {
    const serial = optionalText(payload.serialNumber, 'Serial number', { max: 64 });
    input.serialNumber = serial ? serial.toUpperCase() : null;
  }
  if (has('tyreCondition')) input.tyreCondition = readCondition(payload.tyreCondition);
  if (has('purchaseDate')) input.purchaseDate = optionalDate(payload.purchaseDate, 'Purchase date');
  if (has('purchaseCost')) {
    const cost = optionalNumber(payload.purchaseCost, 'Purchase cost', { min: 0 });
    input.purchaseCost = cost == null ? null : roundMoney(cost);
  }
  if (has('purchasedFrom')) input.purchasedFrom = optionalText(payload.purchasedFrom, 'Purchased from', { max: 255 });
  if (has('notes')) input.notes = optionalText(payload.notes, 'Notes', { max: 2000 });

  return input;
}

function readMeterReading(value, label = 'Meter reading') {
  return roundMoney(requireNumber(value, label, { min: 0 }));
}

function readRemovalReason(value) {
  const reason = requireText(value, 'Reason for removal', { max: 20 }).toUpperCase();
  if (!TyreAssignment.REMOVAL_REASONS.includes(reason) || reason === 'ROTATION') {
    const allowed = TyreAssignment.REMOVAL_REASONS.filter((r) => r !== 'ROTATION');
    throw AppError.badRequest(`Reason for removal must be one of: ${allowed.join(', ')}`);
  }
  return reason;
}

function readRemovalOutcome(value) {
  const outcome = requireText(value, 'What happens to the tyre', { max: 20 });
  if (!['in_stock', 'scrapped'].includes(outcome)) {
    throw AppError.badRequest('What happens to the tyre must be either in_stock or scrapped');
  }
  return outcome;
}

async function activeFitmentsFor(tenantId, tyreIds, { transaction } = {}) {
  if (tyreIds.length === 0) return new Map();
  const rows = await TyreAssignment.findAll({
    where: { tenantId, tyreId: tyreIds, removedAt: null },
    transaction,
  });
  return new Map(rows.map((row) => [row.tyreId, row]));
}

async function tyreWhereForSite(tenantId, siteId) {
  const vehiclesAtSite = await Vehicle.findAll({ where: { tenantId, currentSiteId: siteId }, attributes: ['id'] });
  const vehicleIds = vehiclesAtSite.map((v) => v.id);
  const fitted = vehicleIds.length
    ? await TyreAssignment.findAll({
        where: { tenantId, vehicleId: vehicleIds, removedAt: null },
        attributes: ['tyreId'],
      })
    : [];
  const fittedTyreIds = fitted.map((f) => f.tyreId);

  const options = [{ siteId, state: { [Op.ne]: 'fitted' } }];
  if (fittedTyreIds.length) options.push({ id: fittedTyreIds });
  return { [Op.or]: options };
}

async function locationSiteIdOf(tenantId, tyre, { transaction } = {}) {
  if (tyre.state !== 'fitted') return tyre.siteId;
  const fitment = await TyreAssignment.findOne({ where: { tenantId, tyreId: tyre.id, removedAt: null }, transaction });
  if (!fitment) return tyre.siteId;
  const vehicle = await Vehicle.findOne({ where: { tenantId, id: fitment.vehicleId }, attributes: ['currentSiteId'], transaction });
  return vehicle?.currentSiteId ?? tyre.siteId;
}

async function findVisibleTyre(tenantId, auth, id, { transaction, lock = false } = {}) {
  const tyre = await repo.findByPk(tenantId, id, {
    transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!tyre) throw AppError.notFound(NOT_FOUND);

  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) {
    const locationSiteId = await locationSiteIdOf(tenantId, tyre, { transaction });
    if (Number(locationSiteId) !== Number(ownSiteId)) throw AppError.notFound(NOT_FOUND);
  }
  return tyre;
}

async function findVisibleVehicle(tenantId, auth, vehicleId, { transaction, lock = false } = {}) {
  const id = Number(vehicleId);
  if (!Number.isInteger(id) || id < 1) throw AppError.badRequest('Vehicle is required');
  const vehicle = await Vehicle.findOne({
    where: { tenantId, id },
    transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!vehicle) throw AppError.notFound('Vehicle not found');
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null && Number(vehicle.currentSiteId) !== Number(ownSiteId)) {
    throw AppError.notFound('Vehicle not found');
  }
  return vehicle;
}

async function assertSiteUsable(tenantId, siteId) {
  const id = Number(siteId);
  if (!Number.isInteger(id) || id < 1) throw AppError.badRequest('Site is required');
  const site = await Site.findOne({ where: { tenantId, id } });
  if (!site) throw AppError.badRequest('Site not found');
  if (site.status !== 'active') throw AppError.badRequest('This site is archived and cannot be used');
  return id;
}

function assertTyreActive(tyre) {
  if (tyre.status !== 'active') {
    throw AppError.conflict('This tyre has been deleted. Restore it first.');
  }
}

async function vehiclesById(tenantId, ids, { transaction } = {}) {
  const unique = [...new Set(ids.filter((id) => id != null))];
  if (unique.length === 0) return new Map();
  const vehicles = await Vehicle.findAll({ where: { tenantId, id: unique }, transaction });
  return new Map(vehicles.map((v) => [v.id, v]));
}

function vehicleSummary(vehicle) {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    assetId: vehicle.assetId,
    registrationNumber: vehicle.registrationNumber,
    type: vehicle.type,
    status: vehicle.status,
    currentSiteId: vehicle.currentSiteId,
  };
}

function fitmentJSON(assignment, vehicle) {
  return {
    ...assignment.toPublicJSON(),
    positionLabel: positionLabel(vehicle, assignment.position),
    removalReasonLabel: assignment.removalReason ? REMOVAL_REASON_LABELS[assignment.removalReason] : null,
    running: runningFor(assignment, vehicle),
    vehicle: vehicleSummary(vehicle),
  };
}

async function decorateTyres(tenantId, tyres, { transaction } = {}) {
  if (tyres.length === 0) return [];
  const tyreIds = tyres.map((t) => t.id);
  const assignments = await TyreAssignment.findAll({ where: { tenantId, tyreId: tyreIds }, transaction });
  const vehicles = await vehiclesById(tenantId, assignments.map((a) => a.vehicleId), { transaction });

  const byTyre = new Map();
  for (const a of assignments) {
    if (!byTyre.has(a.tyreId)) byTyre.set(a.tyreId, []);
    byTyre.get(a.tyreId).push(a);
  }

  const rows = tyres.map((tyre) => {
    const own = byTyre.get(tyre.id) ?? [];
    let totalRunKM = 0;
    let totalRunHours = 0;
    let current = null;
    for (const a of own) {
      const vehicle = vehicles.get(a.vehicleId);
      const run = runningFor(a, vehicle);
      if (a.meterType === 'HOURS') totalRunHours += run;
      else totalRunKM += run;
      if (a.removedAt == null) current = fitmentJSON(a, vehicle);
    }
    const locationSiteId = current?.vehicle?.currentSiteId ?? tyre.siteId;
    return {
      ...tyre.toPublicJSON(),
      locationSiteId,
      currentFitment: current,
      fitmentCount: own.length,
      totalRunKM: roundMoney(totalRunKM),
      totalRunHours: roundMoney(totalRunHours),
    };
  });

  const siteNames = await siteNamesById(tenantId, rows.flatMap((r) => [r.siteId, r.locationSiteId]));
  return rows.map((r) => ({
    ...r,
    siteName: siteNames.get(r.siteId) ?? null,
    locationSiteName: siteNames.get(r.locationSiteId) ?? null,
  }));
}

async function listTyres({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Tyre.STATUSES, 'Status') ?? 'active';
  const and = [{ status }];

  const state = parseEnumFilter(query.state, Tyre.STATES, 'State');
  if (state) and.push({ state });
  const condition = parseEnumFilter(query.tyreCondition, Tyre.CONDITIONS, 'Condition');
  if (condition) and.push({ tyreCondition: condition });

  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId ?? (query.siteId ? Number(query.siteId) : null);
  if (siteId) and.push(await tyreWhereForSite(tenantId, siteId));

  if (query.storedAtSiteId) and.push({ siteId: Number(query.storedAtSiteId) });

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    and.push({
      [Op.or]: [{ tyreCode: like }, { serialNumber: like }, { brand: like }, { modelName: like }, { size: like }],
    });
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, {
    where: { [Op.and]: and },
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
  });

  return buildListResponse(await decorateTyres(tenantId, rows), { page, limit, total: count });
}

async function getTyre({ tenantId, auth, id }) {
  const tyre = await findVisibleTyre(tenantId, auth, id);
  const [json] = await decorateTyres(tenantId, [tyre]);

  const assignments = await TyreAssignment.findAll({
    where: { tenantId, tyreId: tyre.id },
    order: [['installedAt', 'DESC'], ['id', 'DESC']],
  });
  const vehicles = await vehiclesById(tenantId, assignments.map((a) => a.vehicleId));
  const siteNames = await siteNamesById(tenantId, assignments.map((a) => a.siteId));

  return {
    ...json,
    fitments: assignments.map((a) => ({ ...fitmentJSON(a, vehicles.get(a.vehicleId)), siteName: siteNames.get(a.siteId) ?? null })),
  };
}

async function assertSerialAvailable(tenantId, serialNumber, excludeId = null) {
  if (!serialNumber) return;
  const where = { tenantId, serialNumber };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await Tyre.findOne({ where, attributes: ['tyreCode'] });
  if (existing) {
    throw AppError.conflict(`Serial number ${serialNumber} is already used by tyre ${existing.tyreCode}`);
  }
}

function serialCollision(error) {
  return isCodeCollision(error, 'uq_tyres_tenant_serial');
}

async function createTyre({ tenantId, auth, actingUserId, payload }) {
  const input = readTyreInput(payload);
  const ownSiteId = supervisorSiteId(auth);
  input.siteId = ownSiteId ?? (await assertSiteUsable(tenantId, payload.siteId));
  await assertSerialAvailable(tenantId, input.serialNumber);

  try {
    const tyre = await sequelize.transaction(async (transaction) => {
      let created;
      for (let attempt = 1; attempt <= TYRE_CODE_GENERATION_ATTEMPTS; attempt += 1) {
        const tyreCode = await nextSequentialCode(Tyre, 'tyreCode', TYRE_CODE_PREFIX, { tenantId, transaction });
        try {
          created = await repo.create(
            tenantId,
            { ...input, tyreCode, state: 'in_stock', createdBy: actingUserId, updatedBy: actingUserId },
            { transaction }
          );
          break;
        } catch (error) {
          const isLastAttempt = attempt === TYRE_CODE_GENERATION_ATTEMPTS;
          if (!isCodeCollision(error, 'uq_tyres_tenant_code') || isLastAttempt) throw error;
        }
      }

      await recordCreate(
        { tenantId, entityType: 'Tyre', entityId: created.id, performedBy: actingUserId, after: created },
        { transaction }
      );
      return created;
    });

    return getTyre({ tenantId, auth, id: tyre.id });
  } catch (error) {
    if (serialCollision(error)) {
      throw AppError.conflict(`Serial number ${input.serialNumber} is already used by another tyre`);
    }
    throw error;
  }
}

async function updateTyre({ tenantId, auth, actingUserId, id, payload }) {
  const tyre = await findVisibleTyre(tenantId, auth, id);
  assertTyreActive(tyre);

  const input = readTyreInput(payload, { partial: true });
  if (input.serialNumber !== undefined) await assertSerialAvailable(tenantId, input.serialNumber, tyre.id);

  if (payload.siteId !== undefined && payload.siteId !== null && payload.siteId !== '' && Number(payload.siteId) !== tyre.siteId) {
    if (supervisorSiteId(auth) !== null) {
      throw AppError.forbidden('Only an Admin can move a tyre to a different site');
    }
    if (tyre.state === 'fitted') {
      throw AppError.conflict("A fitted tyre goes wherever its vehicle goes. Remove it from the vehicle before changing its site.");
    }
    input.siteId = await assertSiteUsable(tenantId, payload.siteId);
  }

  const before = tyre.toJSON();
  try {
    await sequelize.transaction(async (transaction) => {
      await tyre.update({ ...input, updatedBy: actingUserId }, { transaction });
      await recordUpdate(
        { tenantId, entityType: 'Tyre', entityId: tyre.id, performedBy: actingUserId, before, after: tyre },
        { transaction }
      );
    });
  } catch (error) {
    if (serialCollision(error)) {
      throw AppError.conflict(`Serial number ${input.serialNumber} is already used by another tyre`);
    }
    throw error;
  }

  return getTyre({ tenantId, auth, id: tyre.id });
}

async function deleteTyre({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Tyre,
    entityType: 'Tyre',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
    dependencyCheck: async (tyre) => {
      if (tyre.state === 'fitted') {
        throw AppError.conflict('This tyre is fitted to a vehicle. Remove it from the vehicle before deleting it.');
      }
    },
  });
  return archived.toPublicJSON();
}

async function restoreTyre({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({ model: Tyre, entityType: 'Tyre', tenantId, id, performedBy: actingUserId });
  return restored.toPublicJSON();
}

function assertNotAheadOfVehicle(vehicle, meterType, reading) {
  const current = readingFor(vehicle, meterType);
  if (current == null) return;
  if (reading > current) {
    const unit = meterUnit(meterType);
    throw AppError.badRequest(
      `Meter reading can't be more than the vehicle's current ${unit} (${formatReading(current)}). If the vehicle has run further, update its current ${unit} on the vehicle page first.`
    );
  }
}

function positionConflictMessage(vehicle, code) {
  return `${positionLabel(vehicle, code)} on ${vehicle.registrationNumber} already has a tyre. Remove that tyre first, or choose another position.`;
}

async function lastRemovalOf(tenantId, tyreId, { transaction } = {}) {
  return TyreAssignment.findOne({
    where: { tenantId, tyreId, removedAt: { [Op.ne]: null } },
    order: [['removedAt', 'DESC'], ['id', 'DESC']],
    transaction,
  });
}

async function installTyre({ tenantId, auth, actingUserId, id, payload }) {
  const positionCode = requireText(payload.position, 'Position', { max: 16 }).toUpperCase();
  const installedAt = requireBusinessDate(payload.installedAt, 'Fitting date');
  const installMeterReading = readMeterReading(payload.installMeterReading, 'Meter reading at fitting');
  const installNotes = optionalText(payload.notes, 'Notes', { max: 1000 });

  try {
    await sequelize.transaction(async (transaction) => {
      const tyre = await findVisibleTyre(tenantId, auth, id, { transaction, lock: true });
      assertTyreActive(tyre);
      if (tyre.state === 'scrapped') throw AppError.conflict('A scrapped tyre cannot be fitted again.');
      if (tyre.state === 'fitted') {
        throw AppError.conflict('This tyre is already fitted to a vehicle. Remove it first, or use Rotate to move it to another position.');
      }

      const vehicle = await findVisibleVehicle(tenantId, auth, payload.vehicleId, { transaction, lock: true });
      if (vehicle.status !== 'active') {
        throw AppError.badRequest('This vehicle is archived — tyres cannot be fitted to it');
      }

      const position = findPosition(vehicle, positionCode);
      if (!position) {
        throw AppError.badRequest(`${positionCode} is not a valid position on a ${vehicle.type}`);
      }

      if (vehicle.currentSiteId && Number(vehicle.currentSiteId) !== Number(tyre.siteId)) {
        const names = await siteNamesById(tenantId, [vehicle.currentSiteId, tyre.siteId]);
        throw AppError.badRequest(
          `This tyre is kept at ${names.get(tyre.siteId) ?? 'another site'}, but ${vehicle.registrationNumber} is at ${names.get(vehicle.currentSiteId) ?? 'another site'}. Pick a tyre kept at the vehicle's site, or ask an Admin to move the tyre first.`
        );
      }

      const meterType = meterTypeFor(vehicle);
      if (readingFor(vehicle, meterType) == null) {
        throw AppError.badRequest(`${vehicle.registrationNumber} has no current ${meterUnit(meterType)} recorded. Update the vehicle first.`);
      }
      assertNotAheadOfVehicle(vehicle, meterType, installMeterReading);

      if (tyre.purchaseDate && installedAt < tyre.purchaseDate) {
        throw AppError.badRequest(`Fitting date can't be before the tyre's purchase date (${tyre.purchaseDate})`);
      }
      const lastRemoval = await lastRemovalOf(tenantId, tyre.id, { transaction });
      if (lastRemoval && installedAt < lastRemoval.removedAt) {
        throw AppError.badRequest(`Fitting date can't be before this tyre was last removed (${lastRemoval.removedAt})`);
      }

      const occupied = await TyreAssignment.findOne({
        where: { tenantId, vehicleId: vehicle.id, position: positionCode, removedAt: null },
        transaction,
      });
      if (occupied) throw AppError.conflict(positionConflictMessage(vehicle, positionCode));

      const assignment = await assignmentRepo.create(
        tenantId,
        {
          tyreId: tyre.id,
          vehicleId: vehicle.id,
          siteId: vehicle.currentSiteId ?? null,
          position: positionCode,
          meterType,
          installedAt,
          installMeterReading,
          installNotes,
          installedBy: actingUserId,
        },
        { transaction }
      );

      const before = tyre.toJSON();
      await tyre.update({ state: 'fitted', updatedBy: actingUserId }, { transaction });

      await recordCreate(
        { tenantId, entityType: 'TyreAssignment', entityId: assignment.id, performedBy: actingUserId, after: assignment },
        { transaction }
      );
      await recordUpdate(
        { tenantId, entityType: 'Tyre', entityId: tyre.id, performedBy: actingUserId, before, after: tyre },
        { transaction }
      );
    });
  } catch (error) {
    if (isCodeCollision(error, 'uq_tyre_assignments_active_position')) {
      throw AppError.conflict('That position was just filled by someone else. Refresh and choose another position.');
    }
    if (isCodeCollision(error, 'uq_tyre_assignments_active_tyre')) {
      throw AppError.conflict('This tyre was just fitted by someone else. Refresh to see where it is.');
    }
    throw error;
  }

  return getTyre({ tenantId, auth, id });
}

async function closeFitment(assignment, vehicle, { removedAt, removeMeterReading, removalReason, removalOutcome, removeNotes, actingUserId, transaction }) {
  if (removedAt < assignment.installedAt) {
    throw AppError.badRequest(`Date can't be before the tyre was fitted (${assignment.installedAt})`);
  }
  if (removeMeterReading < Number(assignment.installMeterReading)) {
    throw AppError.badRequest(
      `Meter reading can't be lower than the reading when the tyre was fitted (${formatReading(assignment.installMeterReading)} ${meterUnit(assignment.meterType)})`
    );
  }
  assertNotAheadOfVehicle(vehicle, assignment.meterType, removeMeterReading);

  const before = assignment.toJSON();
  await assignment.update(
    { removedAt, removeMeterReading, removalReason, removalOutcome, removeNotes, removedBy: actingUserId },
    { transaction }
  );
  await recordUpdate(
    {
      tenantId: assignment.tenantId,
      entityType: 'TyreAssignment',
      entityId: assignment.id,
      performedBy: actingUserId,
      before,
      after: assignment,
    },
    { transaction }
  );
}

async function loadActiveFitment(tenantId, tyre, { transaction }) {
  const assignment = await TyreAssignment.findOne({
    where: { tenantId, tyreId: tyre.id, removedAt: null },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!assignment) throw AppError.conflict('This tyre is not fitted to any vehicle.');
  const vehicle = await Vehicle.findOne({
    where: { tenantId, id: assignment.vehicleId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  return { assignment, vehicle };
}

async function removeTyre({ tenantId, auth, actingUserId, id, payload }) {
  const removedAt = requireBusinessDate(payload.removedAt, 'Removal date');
  const removeMeterReading = readMeterReading(payload.removeMeterReading, 'Meter reading at removal');
  const removalReason = readRemovalReason(payload.reason);
  const removalOutcome = readRemovalOutcome(payload.outcome);
  const removeNotes = optionalText(payload.notes, 'Notes', { max: 1000 });
  if (removalReason === 'OTHER' && !removeNotes) {
    throw AppError.badRequest('Add a note explaining why the tyre was removed');
  }

  await sequelize.transaction(async (transaction) => {
    const tyre = await findVisibleTyre(tenantId, auth, id, { transaction, lock: true });
    assertTyreActive(tyre);
    const { assignment, vehicle } = await loadActiveFitment(tenantId, tyre, { transaction });

    await closeFitment(assignment, vehicle, {
      removedAt,
      removeMeterReading,
      removalReason,
      removalOutcome,
      removeNotes,
      actingUserId,
      transaction,
    });

    const before = tyre.toJSON();
    const changes = { state: removalOutcome, siteId: vehicle?.currentSiteId ?? tyre.siteId, updatedBy: actingUserId };
    if (removalOutcome === 'scrapped') {
      changes.scrappedAt = removedAt;
      changes.scrapReason = [REMOVAL_REASON_LABELS[removalReason], removeNotes].filter(Boolean).join(' — ');
    }
    await tyre.update(changes, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'Tyre', entityId: tyre.id, performedBy: actingUserId, before, after: tyre },
      { transaction }
    );
  });

  return getTyre({ tenantId, auth, id });
}

async function rotateTyre({ tenantId, auth, actingUserId, id, payload }) {
  const targetCode = requireText(payload.position, 'New position', { max: 16 }).toUpperCase();
  const rotatedAt = requireBusinessDate(payload.rotatedAt, 'Rotation date');
  const meterReading = readMeterReading(payload.meterReading, 'Meter reading at rotation');
  const notes = optionalText(payload.notes, 'Notes', { max: 1000 });

  try {
    await sequelize.transaction(async (transaction) => {
      const tyre = await findVisibleTyre(tenantId, auth, id, { transaction, lock: true });
      assertTyreActive(tyre);
      const { assignment, vehicle } = await loadActiveFitment(tenantId, tyre, { transaction });
      if (vehicle.status !== 'active') throw AppError.badRequest('This vehicle is archived — tyres cannot be rotated on it');

      const sourceCode = assignment.position;
      if (targetCode === sourceCode) throw AppError.badRequest('Choose a different position to move the tyre to');
      if (!findPosition(vehicle, targetCode)) {
        throw AppError.badRequest(`${targetCode} is not a valid position on a ${vehicle.type}`);
      }

      const other = await TyreAssignment.findOne({
        where: { tenantId, vehicleId: vehicle.id, position: targetCode, removedAt: null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const otherTyre = other
        ? await Tyre.findOne({ where: { tenantId, id: other.tyreId }, transaction, lock: transaction.LOCK.UPDATE })
        : null;

      const close = (fitment) =>
        closeFitment(fitment, vehicle, {
          removedAt: rotatedAt,
          removeMeterReading: meterReading,
          removalReason: 'ROTATION',
          removalOutcome: 'refitted',
          removeNotes: notes,
          actingUserId,
          transaction,
        });

      await close(assignment);
      if (other) await close(other);

      const open = async (tyreId, position) => {
        const created = await assignmentRepo.create(
          tenantId,
          {
            tyreId,
            vehicleId: vehicle.id,
            siteId: vehicle.currentSiteId ?? null,
            position,
            meterType: assignment.meterType,
            installedAt: rotatedAt,
            installMeterReading: meterReading,
            installNotes: notes,
            installedBy: actingUserId,
          },
          { transaction }
        );
        await recordCreate(
          { tenantId, entityType: 'TyreAssignment', entityId: created.id, performedBy: actingUserId, after: created },
          { transaction }
        );
      };

      await open(tyre.id, targetCode);
      if (otherTyre) await open(otherTyre.id, sourceCode);

      await tyre.update({ updatedBy: actingUserId }, { transaction });
      if (otherTyre) await otherTyre.update({ updatedBy: actingUserId }, { transaction });
    });
  } catch (error) {
    if (isCodeCollision(error, 'uq_tyre_assignments_active_position') || isCodeCollision(error, 'uq_tyre_assignments_active_tyre')) {
      throw AppError.conflict('The tyres on this vehicle were just changed by someone else. Refresh and try again.');
    }
    throw error;
  }

  return getTyre({ tenantId, auth, id });
}

async function scrapTyre({ tenantId, auth, actingUserId, id, payload }) {
  const scrappedAt = requireBusinessDate(payload.scrappedAt, 'Scrap date');
  const scrapReason = requireText(payload.reason, 'Reason', { max: 500 });

  await sequelize.transaction(async (transaction) => {
    const tyre = await findVisibleTyre(tenantId, auth, id, { transaction, lock: true });
    assertTyreActive(tyre);
    if (tyre.state === 'fitted') {
      throw AppError.conflict('This tyre is fitted to a vehicle. Remove it and choose "Scrap" as the outcome.');
    }
    if (tyre.state === 'scrapped') throw AppError.conflict('This tyre is already scrapped.');

    if (tyre.purchaseDate && scrappedAt < tyre.purchaseDate) {
      throw AppError.badRequest(`Scrap date can't be before the tyre's purchase date (${tyre.purchaseDate})`);
    }
    const lastRemoval = await lastRemovalOf(tenantId, tyre.id, { transaction });
    if (lastRemoval && scrappedAt < lastRemoval.removedAt) {
      throw AppError.badRequest(`Scrap date can't be before this tyre was last removed (${lastRemoval.removedAt})`);
    }

    const before = tyre.toJSON();
    await tyre.update({ state: 'scrapped', scrappedAt, scrapReason, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'Tyre', entityId: tyre.id, performedBy: actingUserId, before, after: tyre },
      { transaction }
    );
  });

  return getTyre({ tenantId, auth, id });
}

async function vehicleTyrePositions({ tenantId, auth, vehicleId }) {
  const vehicle = await findVisibleVehicle(tenantId, auth, vehicleId);
  const meterType = meterTypeFor(vehicle);

  const active = await TyreAssignment.findAll({ where: { tenantId, vehicleId: vehicle.id, removedAt: null } });
  const tyres = active.length ? await Tyre.findAll({ where: { tenantId, id: active.map((a) => a.tyreId) } }) : [];
  const tyreById = new Map(tyres.map((t) => [t.id, t]));
  const byPosition = new Map(active.map((a) => [a.position, a]));

  const fittedJSON = (assignment) => {
    const tyre = tyreById.get(assignment.tyreId);
    return {
      ...fitmentJSON(assignment, vehicle),
      vehicle: undefined,
      tyre: tyre
        ? {
            id: tyre.id,
            tyreCode: tyre.tyreCode,
            serialNumber: tyre.serialNumber,
            brand: tyre.brand,
            modelName: tyre.modelName,
            size: tyre.size,
            tyreCondition: tyre.tyreCondition,
          }
        : null,
    };
  };

  const layout = positionsForVehicle(vehicle);
  const known = new Set(layout.map((p) => p.code));
  const positions = layout.map((p) => ({ ...p, fitted: byPosition.has(p.code) ? fittedJSON(byPosition.get(p.code)) : null }));

  for (const a of active) {
    if (!known.has(a.position)) {
      positions.push({ code: a.position, label: positionLabel(null, a.position), axle: null, side: null, slot: 'other', fitted: fittedJSON(a) });
    }
  }

  return {
    vehicle: {
      ...vehicleSummary(vehicle),
      isHoursBased: vehicle.isHoursBased,
      meterType,
      currentReading: readingFor(vehicle, meterType),
    },
    positions,
  };
}

async function listFitments({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: FITMENT_SORTABLE_FIELDS,
    defaultSort: FITMENT_DEFAULT_SORT,
  });

  const and = [];
  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId ?? (query.siteId ? Number(query.siteId) : null);
  if (siteId) and.push({ siteId });

  if (query.vehicleId) and.push({ vehicleId: Number(query.vehicleId) });
  if (query.tyreId) and.push({ tyreId: Number(query.tyreId) });

  const openFilter = parseEnumFilter(query.open, ['fitted', 'removed'], 'Fitment status');
  if (openFilter === 'fitted') and.push({ removedAt: null });
  if (openFilter === 'removed') and.push({ removedAt: { [Op.ne]: null } });

  const reason = parseEnumFilter(query.reason, TyreAssignment.REMOVAL_REASONS, 'Reason');
  if (reason) and.push({ removalReason: reason });

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range[Op.gte] = dateFrom;
    if (dateTo) range[Op.lte] = dateTo;
    and.push({ [Op.or]: [{ installedAt: range }, { removedAt: range }] });
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    const [tyres, vehicles] = await Promise.all([
      Tyre.findAll({ where: { tenantId, [Op.or]: [{ tyreCode: like }, { serialNumber: like }, { brand: like }] }, attributes: ['id'] }),
      Vehicle.findAll({ where: { tenantId, [Op.or]: [{ registrationNumber: like }, { assetId: like }] }, attributes: ['id'] }),
    ]);
    const options = [];
    if (tyres.length) options.push({ tyreId: tyres.map((t) => t.id) });
    if (vehicles.length) options.push({ vehicleId: vehicles.map((v) => v.id) });
    and.push(options.length ? { [Op.or]: options } : { id: null });
  }

  const { rows, count } = await assignmentRepo.findAndCountAll(tenantId, {
    where: and.length ? { [Op.and]: and } : {},
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
  });

  const [vehicles, tyres, siteNames] = await Promise.all([
    vehiclesById(tenantId, rows.map((r) => r.vehicleId)),
    rows.length ? Tyre.findAll({ where: { tenantId, id: [...new Set(rows.map((r) => r.tyreId))] } }) : [],
    siteNamesById(tenantId, rows.map((r) => r.siteId)),
  ]);
  const tyreById = new Map(tyres.map((t) => [t.id, t]));

  const data = rows.map((row) => {
    const tyre = tyreById.get(row.tyreId);
    return {
      ...fitmentJSON(row, vehicles.get(row.vehicleId)),
      siteName: siteNames.get(row.siteId) ?? null,
      tyre: tyre
        ? { id: tyre.id, tyreCode: tyre.tyreCode, serialNumber: tyre.serialNumber, brand: tyre.brand, size: tyre.size, status: tyre.status }
        : null,
    };
  });

  return buildListResponse(data, { page, limit, total: count });
}

module.exports = {
  REMOVAL_REASON_LABELS,
  listTyres,
  getTyre,
  createTyre,
  updateTyre,
  deleteTyre,
  restoreTyre,
  installTyre,
  removeTyre,
  rotateTyre,
  scrapTyre,
  vehicleTyrePositions,
  listFitments,
};
