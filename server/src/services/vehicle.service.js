const { Op } = require('sequelize');

const { sequelize, Vehicle, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber } = require('../utils/validation');
const { assertMeterNotDecreasing } = require('../utils/meter');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const storage = require('./storage.service');
const { assertSiteAssignable } = require('./site.service');
const { saveComplianceDocuments } = require('./complianceDocument.service');
const { getMandatoryDocTypes, createDocumentsForNewAsset } = require('./assetDocument.service');

const repo = createTenantScopedRepository(Vehicle);

const SORTABLE_FIELDS = ['createdAt', 'registrationNumber', 'currentKM', 'assetId'];
const DEFAULT_SORT = 'createdAt:desc';

const ASSET_ID_GENERATION_ATTEMPTS = 5;

function toPublic(vehicle) {
  return vehicle.toPublicJSON();
}

async function generateAssetId(tenantId, { transaction } = {}) {
  const count = await Vehicle.count({ where: { tenantId }, transaction, paranoid: false });
  return `VEH-${String(count + 1).padStart(6, '0')}`;
}

function isHoursBasedType(type) {
  return type === Vehicle.HOURS_BASED_TYPE;
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

function readVehicleBaseInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.registrationNumber !== undefined) {
    input.registrationNumber = requireText(payload.registrationNumber, 'Registration number', {
      max: 32,
    });
  }
  if (!partial || payload.type !== undefined) {
    const type = requireText(payload.type, 'Type', { max: 100 });
    if (!Vehicle.TYPES.includes(type)) {
      throw AppError.badRequest(`Type must be one of: ${Vehicle.TYPES.join(', ')}`);
    }
    input.type = type;
  }
  if (!partial || payload.fuelType !== undefined) {
    const fuelType = requireText(payload.fuelType, 'Fuel type', { max: 50 });
    if (!Vehicle.FUEL_TYPES.includes(fuelType)) {
      throw AppError.badRequest(`Fuel type must be one of: ${Vehicle.FUEL_TYPES.join(', ')}`);
    }
    input.fuelType = fuelType;
  }
  if (!partial || payload.modelNumber !== undefined) {
    input.modelNumber = optionalText(payload.modelNumber, 'Model number', { max: 100 });
  }
  if (!partial || payload.chassisNumber !== undefined) {
    input.chassisNumber = optionalText(payload.chassisNumber, 'Chassis number', { max: 100 });
  }
  if (!partial || payload.year !== undefined) {
    input.year =
      payload.year === undefined || payload.year === null || payload.year === ''
        ? null
        : requireNumber(payload.year, 'Year', { min: 1900 });
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

const BLANK_KM_METER = { currentKM: null, serviceIntervalKM: null, nextServiceKM: null };
const BLANK_HOURS_METER = { currentHours: null, serviceIntervalHours: null, nextServiceHours: null };

function readMeterInputForCreate(payload, type) {
  if (isHoursBasedType(type)) {
    const currentHours = requireNumber(payload.currentHours, 'Current hours', { min: 0 });
    const serviceIntervalHours = requireNumber(payload.serviceIntervalHours, 'Service interval (hours)', {
      min: 1,
    });
    return {
      ...BLANK_KM_METER,
      currentHours,
      serviceIntervalHours,
      nextServiceHours: currentHours + serviceIntervalHours,
    };
  }

  const currentKM = requireNumber(payload.currentKM, 'Current KM', { min: 0 });
  const serviceIntervalKM = requireNumber(payload.serviceIntervalKM, 'Service interval (KM)', { min: 1 });
  return {
    currentKM,
    serviceIntervalKM,
    nextServiceKM: currentKM + serviceIntervalKM,
    ...BLANK_HOURS_METER,
  };
}

function readMeterInputForUpdate(payload, vehicle, nextType) {
  const wasHoursBased = isHoursBasedType(vehicle.type);
  const willBeHoursBased = isHoursBasedType(nextType);
  const basisChanged = wasHoursBased !== willBeHoursBased;

  if (willBeHoursBased) {
    if (payload.currentKM !== undefined || payload.serviceIntervalKM !== undefined) {
      throw AppError.badRequest('Current KM and service interval (KM) do not apply to a Heavy Vehicle');
    }

    if (basisChanged) {
      const currentHours = requireNumber(payload.currentHours, 'Current hours', { min: 0 });
      const serviceIntervalHours = requireNumber(payload.serviceIntervalHours, 'Service interval (hours)', {
        min: 1,
      });
      return {
        ...BLANK_KM_METER,
        currentHours,
        serviceIntervalHours,
        nextServiceHours: currentHours + serviceIntervalHours,
      };
    }

    const nextCurrentHours =
      payload.currentHours !== undefined
        ? assertMeterNotDecreasing(vehicle.currentHours, payload.currentHours, 'Hours')
        : Number(vehicle.currentHours);
    const nextIntervalHours =
      payload.serviceIntervalHours !== undefined
        ? requireNumber(payload.serviceIntervalHours, 'Service interval (hours)', { min: 1 })
        : Number(vehicle.serviceIntervalHours);
    const nextServiceHours =
      payload.serviceIntervalHours !== undefined
        ? nextCurrentHours + nextIntervalHours
        : Number(vehicle.nextServiceHours);

    return {
      ...BLANK_KM_METER,
      currentHours: nextCurrentHours,
      serviceIntervalHours: nextIntervalHours,
      nextServiceHours,
    };
  }

  if (payload.currentHours !== undefined || payload.serviceIntervalHours !== undefined) {
    throw AppError.badRequest('Current hours and service interval (hours) do not apply to a Light Vehicle');
  }

  if (basisChanged) {
    const currentKM = requireNumber(payload.currentKM, 'Current KM', { min: 0 });
    const serviceIntervalKM = requireNumber(payload.serviceIntervalKM, 'Service interval (KM)', { min: 1 });
    return {
      currentKM,
      serviceIntervalKM,
      nextServiceKM: currentKM + serviceIntervalKM,
      ...BLANK_HOURS_METER,
    };
  }

  const nextCurrentKM =
    payload.currentKM !== undefined
      ? assertMeterNotDecreasing(vehicle.currentKM, payload.currentKM, 'KM')
      : Number(vehicle.currentKM);
  const nextIntervalKM =
    payload.serviceIntervalKM !== undefined
      ? requireNumber(payload.serviceIntervalKM, 'Service interval (KM)', { min: 1 })
      : Number(vehicle.serviceIntervalKM);
  const nextServiceKM =
    payload.serviceIntervalKM !== undefined ? nextCurrentKM + nextIntervalKM : Number(vehicle.nextServiceKM);

  return {
    currentKM: nextCurrentKM,
    serviceIntervalKM: nextIntervalKM,
    nextServiceKM,
    ...BLANK_HOURS_METER,
  };
}

function assertMandatoryDocuments(files) {
  const missing = getMandatoryDocTypes('VEHICLE').filter((docType) => !files?.[docType]);
  if (missing.length === 0) return;

  const noun = missing.length > 1 ? 'documents are' : 'document is';
  throw AppError.badRequest(`${missing.join(' and ')} ${noun} required to create a vehicle`);
}

async function assertRegistrationAvailable(tenantId, registrationNumber, excludeId) {
  const existing = await Vehicle.findOne({
    where: {
      tenantId,
      registrationNumber,
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });
  if (existing) {
    throw AppError.conflict('A vehicle with this registration number already exists');
  }
}

async function listVehicles({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Vehicle.STATUSES, 'Status') ?? 'active';
  const where = { status };
  if (query.fuelType) where.fuelType = query.fuelType;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where[Op.or] = [
      { assetId: { [Op.like]: `%${search}%` } },
      { registrationNumber: { [Op.like]: `%${search}%` } },
      { modelNumber: { [Op.like]: `%${search}%` } },
    ];
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getVehicle({ tenantId, id }) {
  const vehicle = await repo.findByPk(tenantId, id);
  if (!vehicle) throw AppError.notFound('Vehicle not found');
  return toPublic(vehicle);
}

async function createVehicle({ tenantId, actingUserId, payload, files }) {
  const baseInput = readVehicleBaseInput(payload);
  const siteInput = readCurrentSiteIdInput(payload);
  const meterInput = readMeterInputForCreate(payload, baseInput.type);
  const input = { ...baseInput, ...siteInput, ...meterInput };
  const compliance = parseComplianceField(payload.compliance);

  assertMandatoryDocuments(files);
  await assertRegistrationAvailable(tenantId, input.registrationNumber);
  if (input.currentSiteId != null) {
    await assertSiteAssignable(tenantId, input.currentSiteId);
  }

  const savedKeys = [];

  try {
    const vehicle = await sequelize.transaction(async (transaction) => {
      let created;

      for (let attempt = 1; attempt <= ASSET_ID_GENERATION_ATTEMPTS; attempt += 1) {
        const assetId = await generateAssetId(tenantId, { transaction });
        try {
          created = await repo.create(
            tenantId,
            {
              ...input,
              assetId,
              createdBy: actingUserId,
              updatedBy: actingUserId,
            },
            { transaction }
          );
          break;
        } catch (error) {
          const isLastAttempt = attempt === ASSET_ID_GENERATION_ATTEMPTS;
          if (error.name !== 'SequelizeUniqueConstraintError' || isLastAttempt) throw error;
        }
      }

      await recordCreate(
        { tenantId, entityType: 'Vehicle', entityId: created.id, performedBy: actingUserId, after: created },
        { transaction }
      );

      await saveComplianceDocuments({
        tenantId,
        assetType: 'VEHICLE',
        assetId: created.assetId,
        actingUserId,
        compliance,
        transaction,
      });

      savedKeys.push(
        ...(await createDocumentsForNewAsset({
          tenantId,
          assetType: 'VEHICLE',
          assetId: created.assetId,
          actingUserId,
          files,
          transaction,
        }))
      );

      return created;
    });

    return toPublic(vehicle);
  } catch (error) {
    await Promise.all(savedKeys.map((key) => storage.deleteFile(key).catch(() => {})));
    throw error;
  }
}

async function updateVehicle({ tenantId, actingUserId, id, payload }) {
  const vehicle = await repo.findByPk(tenantId, id);
  if (!vehicle) throw AppError.notFound('Vehicle not found');

  const baseInput = readVehicleBaseInput(payload, { partial: true });

  if (baseInput.registrationNumber && baseInput.registrationNumber !== vehicle.registrationNumber) {
    await assertRegistrationAvailable(tenantId, baseInput.registrationNumber, id);
  }

  const nextType = baseInput.type ?? vehicle.type;
  const meterInput = readMeterInputForUpdate(payload, vehicle, nextType);
  const siteInput = readCurrentSiteIdInput(payload, { partial: true });
  if (siteInput.currentSiteId != null) {
    await assertSiteAssignable(tenantId, siteInput.currentSiteId);
  }
  const compliance = parseComplianceField(payload.compliance);

  const before = vehicle.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await vehicle.update(
      {
        ...baseInput,
        ...siteInput,
        ...meterInput,
        updatedBy: actingUserId,
      },
      { transaction }
    );

    await recordUpdate(
      { tenantId, entityType: 'Vehicle', entityId: vehicle.id, performedBy: actingUserId, before, after: vehicle },
      { transaction }
    );

    await saveComplianceDocuments({
      tenantId,
      assetType: 'VEHICLE',
      assetId: vehicle.assetId,
      actingUserId,
      compliance,
      transaction,
    });

    return vehicle;
  });

  return toPublic(updated);
}

async function deleteVehicle({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Vehicle,
    entityType: 'Vehicle',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function getVehicleHistory({ tenantId, id }) {
  const vehicle = await repo.findByPk(tenantId, id);
  if (!vehicle) throw AppError.notFound('Vehicle not found');

  const entries = await AuditLog.findAll({
    where: { tenantId, entityType: 'Vehicle', entityId: String(id) },
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
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleHistory,
};
