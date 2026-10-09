const { Op } = require('sequelize');

const { sequelize, FuelStation } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(FuelStation);

const SORTABLE_FIELDS = ['createdAt', 'stationName'];
const DEFAULT_SORT = 'stationName:asc';

const STATION_CODE_PREFIX = 'FST-';
const STATION_CODE_GENERATION_ATTEMPTS = 5;

function toPublic(station) {
  return station.toPublicJSON();
}

function readStationInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.stationName !== undefined) {
    input.stationName = requireText(payload.stationName, 'Station name', { max: 255 });
  }
  if (!partial || payload.location !== undefined) {
    input.location = optionalText(payload.location, 'Location', { max: 255 });
  }
  if (!partial || payload.phone !== undefined) {
    input.phone = optionalText(payload.phone, 'Phone', { max: 30 });
  }

  return input;
}

async function assertStationUsable(tenantId, id) {
  const station = await FuelStation.findOne({ where: { tenantId, id } });
  if (!station) throw AppError.badRequest('Fuel station not found');
  if (station.status !== 'active') throw AppError.badRequest('This fuel station is archived and cannot be used');
  return station;
}

async function listFuelStations({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, FuelStation.STATUSES, 'Status') ?? 'active';
  const where = { status };

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.stationName = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getFuelStation({ tenantId, id }) {
  const station = await repo.findByPk(tenantId, id);
  if (!station) throw AppError.notFound('Fuel station not found');
  return toPublic(station);
}

async function createFuelStation({ tenantId, actingUserId, payload }) {
  const input = readStationInput(payload);

  const station = await sequelize.transaction(async (transaction) => {
    let created;

    for (let attempt = 1; attempt <= STATION_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const stationCode = await nextSequentialCode(FuelStation, 'stationCode', STATION_CODE_PREFIX, {
        tenantId,
        transaction,
      });
      try {
        created = await repo.create(
          tenantId,
          { ...input, stationCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === STATION_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_fuel_stations_tenant_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'FuelStation', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(station);
}

async function updateFuelStation({ tenantId, actingUserId, id, payload }) {
  const station = await repo.findByPk(tenantId, id);
  if (!station) throw AppError.notFound('Fuel station not found');

  const input = readStationInput(payload, { partial: true });
  const before = station.toJSON();

  await sequelize.transaction(async (transaction) => {
    await station.update({ ...input, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'FuelStation', entityId: station.id, performedBy: actingUserId, before, after: station },
      { transaction }
    );
  });

  return toPublic(station);
}

async function deleteFuelStation({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: FuelStation,
    entityType: 'FuelStation',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreFuelStation({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: FuelStation,
    entityType: 'FuelStation',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  assertStationUsable,
  listFuelStations,
  getFuelStation,
  createFuelStation,
  updateFuelStation,
  deleteFuelStation,
  restoreFuelStation,
};
