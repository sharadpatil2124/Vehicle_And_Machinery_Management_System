const { Op } = require('sequelize');

const { sequelize, Machinery, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber } = require('../utils/validation');
const { assertMeterNotDecreasing } = require('../utils/meter');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { nextSequentialCode } = require('./codeGenerator');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { assetCostSummary } = require('./assetCost.service');
const {
  scopeToSite,
  assertSiteAllowed,
  assertSiteChangeAllowed,
  supervisorSiteId,
} = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { recordSiteAssignment } = require('./siteAssignment.service');
const {
  assertChassisNumberAvailable,
  assertRcplAvailable,
  isRcplAvailable,
  isRcplCollision,
  RCPL_TAKEN_MESSAGE,
} = require('./assetIdentifier.service');
const { saveComplianceDocuments } = require('./complianceDocument.service');
const { createDocumentsForNewAsset } = require('./assetDocument.service');
const storage = require('./storage.service');

const repo = createTenantScopedRepository(Machinery);

const SORTABLE_FIELDS = ['createdAt', 'currentHours', 'assetId', 'name', 'rcpl'];
const DEFAULT_SORT = 'createdAt:desc';

const ASSET_ID_GENERATION_ATTEMPTS = 5;

function toPublic(machine) {
  return machine.toPublicJSON();
}

const ASSET_ID_PREFIX = 'MCH-';

async function generateAssetId(tenantId, { transaction } = {}) {
  return nextSequentialCode(Machinery, 'assetId', ASSET_ID_PREFIX, { tenantId, transaction });
}

function isAssetIdCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).some((indexName) => indexName.includes('asset_id'))
  );
}

function parseComplianceField(raw) {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw AppError.badRequest('Compliance data is not valid JSON');
    }
  }
  return {};
}

function readMachineryInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.name !== undefined) {
    input.name = optionalText(payload.name, 'Machinery name', { max: 150 });
  }
  if (!partial || payload.rcpl !== undefined) {
    input.rcpl = Machinery.normalizeRcpl(requireText(payload.rcpl, 'RCPL', { max: 32 }));
  }
  if (!partial || payload.type !== undefined) {
    input.type = requireText(payload.type, 'Type', { max: 100 });
  }
  if (!partial || payload.fuelType !== undefined) {
    const fuelType = requireText(payload.fuelType, 'Fuel type', { max: 50 });
    if (!Machinery.FUEL_TYPES.includes(fuelType)) {
      throw AppError.badRequest(`Fuel type must be one of: ${Machinery.FUEL_TYPES.join(', ')}`);
    }
    input.fuelType = fuelType;
  }
  if (!partial || payload.modelNumber !== undefined) {
    input.modelNumber = optionalText(payload.modelNumber, 'Model number', { max: 100 });
  }
  if (!partial || payload.serialNumber !== undefined) {
    input.serialNumber = optionalText(payload.serialNumber, 'Serial number', { max: 100 });
  }
  if (!partial || payload.year !== undefined) {
    input.year =
      payload.year === undefined || payload.year === null || payload.year === ''
        ? null
        : requireNumber(payload.year, 'Year', { min: 1900 });
  }
  if (!partial || payload.currentHours !== undefined) {
    input.currentHours = requireNumber(payload.currentHours, 'Current hours', { min: 0 });
  }
  if (!partial || payload.serviceIntervalHours !== undefined) {
    input.serviceIntervalHours = requireNumber(
      payload.serviceIntervalHours,
      'Service interval (hours)',
      { min: 1 }
    );
  }

  return input;
}

function readCurrentSiteIdInput(payload, { partial = false } = {}) {
  if (payload.currentSiteId === undefined) {
    return partial ? {} : { currentSiteId: null };
  }
  if (payload.currentSiteId === null || payload.currentSiteId === '') {
    return { currentSiteId: null };
  }
  return { currentSiteId: requireNumber(payload.currentSiteId, 'Site', { min: 1 }) };
}

async function listMachinery({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Machinery.STATUSES, 'Status') ?? 'active';
  const where = scopeToSite({ status }, auth);
  if (query.fuelType) where.fuelType = query.fuelType;
  if (query.siteId && supervisorSiteId(auth) === null) where.currentSiteId = requireNumber(query.siteId, 'Site', { min: 1 });

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where[Op.or] = [
      { rcpl: { [Op.like]: containsPattern(search) } },
      { assetId: { [Op.like]: containsPattern(search) } },
      { name: { [Op.like]: containsPattern(search) } },
      { modelNumber: { [Op.like]: containsPattern(search) } },
      { serialNumber: { [Op.like]: containsPattern(search) } },
    ];
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getMachine({ tenantId, auth, id }) {
  const machine = await repo.findByPk(tenantId, id);
  if (!machine) throw AppError.notFound('Machinery not found');
  assertSiteAllowed(auth, machine.currentSiteId, 'Machinery not found');
  return toPublic(machine);
}

async function createMachine({ tenantId, auth, actingUserId, payload, files }) {
  const input = readMachineryInput(payload);
  const siteInput = readCurrentSiteIdInput(payload);
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) siteInput.currentSiteId = ownSiteId;
  await assertRcplAvailable({ tenantId, value: input.rcpl });
  await assertChassisNumberAvailable({ value: input.serialNumber });
  if (siteInput.currentSiteId != null) {
    await assertSiteAssignable(tenantId, siteInput.currentSiteId);
  }
  const compliance = parseComplianceField(payload.compliance);

  const savedKeys = [];

  try {
    const machine = await sequelize.transaction(async (transaction) => {
      let created;

      for (let attempt = 1; attempt <= ASSET_ID_GENERATION_ATTEMPTS; attempt += 1) {
        const assetId = await generateAssetId(tenantId, { transaction });
        try {
          created = await repo.create(
            tenantId,
            {
              ...input,
              ...siteInput,
              assetId,
              nextServiceHours: input.currentHours + input.serviceIntervalHours,
              createdBy: actingUserId,
              updatedBy: actingUserId,
            },
            { transaction }
          );
          break;
        } catch (error) {
          const isLastAttempt = attempt === ASSET_ID_GENERATION_ATTEMPTS;
          if (!isAssetIdCollision(error) || isLastAttempt) throw error;
        }
      }

      await recordCreate(
        { tenantId, entityType: 'Machinery', entityId: created.id, performedBy: actingUserId, after: created },
        { transaction }
      );

      await recordSiteAssignment({
        tenantId,
        assetType: 'MACHINERY',
        assetId: created.assetId,
        previousSiteId: null,
        nextSiteId: created.currentSiteId,
        actingUserId,
        transaction,
      });

      await saveComplianceDocuments({
        tenantId,
        assetType: 'MACHINERY',
        assetId: created.assetId,
        actingUserId,
        compliance,
        transaction,
      });

      savedKeys.push(
        ...(await createDocumentsForNewAsset({
          tenantId,
          assetType: 'MACHINERY',
          assetId: created.assetId,
          actingUserId,
          files,
          transaction,
        }))
      );

      return created;
    });

    return toPublic(machine);
  } catch (error) {
    await Promise.all(savedKeys.map((key) => storage.deleteFile(key).catch(() => {})));
    if (isRcplCollision(error)) throw AppError.conflict(RCPL_TAKEN_MESSAGE);
    throw error;
  }
}

async function checkRcplAvailability({ tenantId, query }) {
  const value = typeof query.rcpl === 'string' ? query.rcpl.trim() : '';
  if (!value) throw AppError.badRequest('RCPL is required');
  const excludeMachineId = query.excludeId ? requireNumber(query.excludeId, 'Machine', { min: 1 }) : undefined;
  return { rcpl: Machinery.normalizeRcpl(value), available: await isRcplAvailable({ tenantId, value, excludeMachineId }) };
}

async function updateMachine({ tenantId, auth, actingUserId, id, payload }) {
  const machine = await repo.findByPk(tenantId, id);
  if (!machine) throw AppError.notFound('Machinery not found');
  assertSiteAllowed(auth, machine.currentSiteId, 'Machinery not found');

  const input = readMachineryInput(payload, { partial: true });
  if (input.rcpl && input.rcpl !== machine.rcpl) {
    await assertRcplAvailable({ tenantId, value: input.rcpl, excludeMachineId: machine.id });
  }
  if (input.serialNumber && input.serialNumber !== machine.serialNumber) {
    await assertChassisNumberAvailable({ value: input.serialNumber, excludeMachineId: id });
  }
  const siteInput = readCurrentSiteIdInput(payload, { partial: true });
  assertSiteChangeAllowed(auth, machine.currentSiteId, siteInput);
  // Only a new site must be assignable: an asset may stay at a site that was archived after it arrived.
  if (siteInput.currentSiteId != null && siteInput.currentSiteId !== machine.currentSiteId) {
    await assertSiteAssignable(tenantId, siteInput.currentSiteId);
  }
  const compliance = payload.compliance ?? {};

  const nextCurrentHours =
    input.currentHours !== undefined
      ? assertMeterNotDecreasing(machine.currentHours, input.currentHours, 'Hours')
      : Number(machine.currentHours);
  const nextIntervalHours =
    input.serviceIntervalHours !== undefined
      ? input.serviceIntervalHours
      : Number(machine.serviceIntervalHours);

  const nextServiceHours =
    input.serviceIntervalHours !== undefined
      ? nextCurrentHours + nextIntervalHours
      : Number(machine.nextServiceHours);

  const updated = await sequelize.transaction(async (transaction) => {
    // Re-read under a row lock so simultaneous saves see each other's site change.
    const current = await repo.findByPk(tenantId, machine.id, { transaction, lock: transaction.LOCK.UPDATE });
    const before = current.toJSON();
    const previousSiteId = current.currentSiteId;
    const nextSiteId = 'currentSiteId' in siteInput ? siteInput.currentSiteId : previousSiteId;

    await current.update(
      {
        ...input,
        ...siteInput,
        currentHours: nextCurrentHours,
        serviceIntervalHours: nextIntervalHours,
        nextServiceHours,
        updatedBy: actingUserId,
      },
      { transaction }
    );

    await recordUpdate(
      { tenantId, entityType: 'Machinery', entityId: current.id, performedBy: actingUserId, before, after: current },
      { transaction }
    );

    await recordSiteAssignment({
      tenantId,
      assetType: 'MACHINERY',
      assetId: current.assetId,
      previousSiteId,
      nextSiteId,
      actingUserId,
      transaction,
    });

    await saveComplianceDocuments({
      tenantId,
      assetType: 'MACHINERY',
      assetId: current.assetId,
      actingUserId,
      compliance,
      transaction,
    });

    return current;
  }).catch((error) => {
    throw isRcplCollision(error) ? AppError.conflict(RCPL_TAKEN_MESSAGE) : error;
  });

  return toPublic(updated);
}

async function deleteMachine({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Machinery,
    entityType: 'Machinery',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreMachine({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: Machinery,
    entityType: 'Machinery',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

async function getMachineHistory({ tenantId, auth, id }) {
  const machine = await repo.findByPk(tenantId, id);
  if (!machine) throw AppError.notFound('Machinery not found');
  assertSiteAllowed(auth, machine.currentSiteId, 'Machinery not found');

  const entries = await AuditLog.findAll({
    where: { tenantId, entityType: 'Machinery', entityId: String(id) },
    order: [['createdAt', 'DESC']],
  });

  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    before: entry.before,
    after: entry.after,
    performedBy: entry.performedBy,
    createdAt: entry.createdAt,
  }));
}

async function getMachineCosts({ tenantId, auth, id }) {
  const machine = await repo.findByPk(tenantId, id);
  if (!machine) throw AppError.notFound('Machinery not found');
  assertSiteAllowed(auth, machine.currentSiteId, 'Machinery not found');
  return assetCostSummary({ tenantId, assetType: 'MACHINERY', assetId: machine.assetId });
}

module.exports = {
  listMachinery,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,
  restoreMachine,
  getMachineHistory,
  getMachineCosts,
  checkRcplAvailability,
};
