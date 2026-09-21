const { Op } = require('sequelize');

const { sequelize, Machinery, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber } = require('../utils/validation');
const { assertMeterNotDecreasing } = require('../utils/meter');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
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
  assertRegistrationNumberAvailable,
} = require('./assetIdentifier.service');
const { saveComplianceDocuments } = require('./complianceDocument.service');
const { createDocumentsForNewAsset } = require('./assetDocument.service');
const storage = require('./storage.service');

const repo = createTenantScopedRepository(Machinery);

const SORTABLE_FIELDS = ['createdAt', 'currentHours', 'assetId', 'name', 'registrationNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const ASSET_ID_GENERATION_ATTEMPTS = 5;

function toPublic(machine) {
  return machine.toPublicJSON();
}

const ASSET_ID_PREFIX = 'MCH-';

/**
 * The next asset id for this tenant, for example "MCH-000007".
 *
 * It counts up from the highest id already in use, NOT from the number of
 * rows. Deleting a machine leaves a gap in the sequence, and "row count + 1"
 * then points at an id that still exists, so every new asset was rejected as a
 * duplicate. Archived assets keep their ids, so they are included here too.
 */
async function generateAssetId(tenantId, { transaction } = {}) {
  const highest = await Machinery.max('assetId', { where: { tenantId }, transaction, paranoid: false });
  const nextNumber = highest ? Number(highest.slice(ASSET_ID_PREFIX.length)) + 1 : 1;
  return `${ASSET_ID_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

/** True when the insert clashed on the generated asset id, not on data the user typed. */
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
  if (!partial || payload.registrationNumber !== undefined) {
    input.registrationNumber = optionalText(payload.registrationNumber, 'Registration number', {
      max: 32,
    });
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
  // A Supervisor only ever sees machines standing at their own site.
  const where = scopeToSite({ status }, auth);
  if (query.fuelType) where.fuelType = query.fuelType;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where[Op.or] = [
      { assetId: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
      { registrationNumber: { [Op.like]: `%${search}%` } },
      { modelNumber: { [Op.like]: `%${search}%` } },
      { serialNumber: { [Op.like]: `%${search}%` } },
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
  // A Supervisor can only add a machine to their own site, so the site is taken
  // from their account rather than from whatever the request asked for.
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) siteInput.currentSiteId = ownSiteId;
  await assertRegistrationNumberAvailable({ value: input.registrationNumber });
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
          // Only an asset-id clash is worth retrying. Anything else — a duplicate
          // registration number, say — must surface with its own message at once.
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
    throw error;
  }
}

async function updateMachine({ tenantId, auth, actingUserId, id, payload }) {
  const machine = await repo.findByPk(tenantId, id);
  if (!machine) throw AppError.notFound('Machinery not found');
  assertSiteAllowed(auth, machine.currentSiteId, 'Machinery not found');

  const input = readMachineryInput(payload, { partial: true });
  if (input.registrationNumber && input.registrationNumber !== machine.registrationNumber) {
    await assertRegistrationNumberAvailable({ value: input.registrationNumber, excludeMachineId: id });
  }
  if (input.serialNumber && input.serialNumber !== machine.serialNumber) {
    await assertChassisNumberAvailable({ value: input.serialNumber, excludeMachineId: id });
  }
  const siteInput = readCurrentSiteIdInput(payload, { partial: true });
  assertSiteChangeAllowed(auth, machine.currentSiteId, siteInput);
  if (siteInput.currentSiteId != null) {
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

  const before = machine.toJSON();
  const previousSiteId = machine.currentSiteId;
  const nextSiteId = 'currentSiteId' in siteInput ? siteInput.currentSiteId : previousSiteId;

  const updated = await sequelize.transaction(async (transaction) => {
    await machine.update(
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
      { tenantId, entityType: 'Machinery', entityId: machine.id, performedBy: actingUserId, before, after: machine },
      { transaction }
    );

    await recordSiteAssignment({
      tenantId,
      assetType: 'MACHINERY',
      assetId: machine.assetId,
      previousSiteId,
      nextSiteId,
      actingUserId,
      transaction,
    });

    await saveComplianceDocuments({
      tenantId,
      assetType: 'MACHINERY',
      assetId: machine.assetId,
      actingUserId,
      compliance,
      transaction,
    });

    return machine;
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

module.exports = {
  listMachinery,
  getMachine,
  createMachine,
  updateMachine,
  deleteMachine,
  restoreMachine,
  getMachineHistory,
};
