const { Op } = require('sequelize');

const { sequelize, StorageLocation } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(StorageLocation);

const SORTABLE_FIELDS = ['createdAt', 'locationName'];
const DEFAULT_SORT = 'locationName:asc';

const LOCATION_CODE_PREFIX = 'LOC-';
const LOCATION_CODE_GENERATION_ATTEMPTS = 5;

function toPublic(location) {
  return location.toPublicJSON();
}

function readStorageLocationInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.siteId !== undefined) {
    input.siteId = requireNumber(payload.siteId, 'Site', { min: 1 });
  }
  if (!partial || payload.locationName !== undefined) {
    input.locationName = requireText(payload.locationName, 'Location name', { max: 150 });
  }
  if (!partial || payload.locationType !== undefined) {
    input.locationType = optionalText(payload.locationType, 'Location type', { max: 50 });
  }
  if (!partial || payload.capacity !== undefined) {
    input.capacity = optionalNumber(payload.capacity, 'Capacity', { min: 0 });
  }
  if (!partial || payload.capacityUom !== undefined) {
    input.capacityUom = optionalText(payload.capacityUom, 'Capacity unit', { max: 32 });
  }

  return input;
}

async function listStorageLocations({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, StorageLocation.STATUSES, 'Status') ?? 'active';
  const where = scopeToSite({ status }, auth, 'siteId');

  if (query.siteId && supervisorSiteId(auth) === null) {
    where.siteId = Number(query.siteId);
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.locationName = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getStorageLocation({ tenantId, auth, id }) {
  const location = await repo.findByPk(tenantId, id);
  if (!location) throw AppError.notFound('Storage location not found');
  assertSiteAllowed(auth, location.siteId, 'Storage location not found');
  return toPublic(location);
}

async function createStorageLocation({ tenantId, actingUserId, payload }) {
  const input = readStorageLocationInput(payload);

  await assertSiteAssignable(tenantId, input.siteId);

  const location = await sequelize.transaction(async (transaction) => {
    let created;

    for (let attempt = 1; attempt <= LOCATION_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const locationCode = await nextSequentialCode(StorageLocation, 'locationCode', LOCATION_CODE_PREFIX, {
        tenantId,
        transaction,
      });
      try {
        created = await repo.create(
          tenantId,
          { ...input, locationCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === LOCATION_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_storage_locations_site_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'StorageLocation', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(location);
}

async function updateStorageLocation({ tenantId, actingUserId, id, payload }) {
  const location = await repo.findByPk(tenantId, id);
  if (!location) throw AppError.notFound('Storage location not found');

  const input = readStorageLocationInput(payload, { partial: true });

  if (input.siteId !== undefined) {
    await assertSiteAssignable(tenantId, input.siteId);
  }

  const before = location.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await location.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      {
        tenantId,
        entityType: 'StorageLocation',
        entityId: location.id,
        performedBy: actingUserId,
        before,
        after: location,
      },
      { transaction }
    );

    return location;
  });

  return toPublic(updated);
}

async function deleteStorageLocation({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: StorageLocation,
    entityType: 'StorageLocation',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreStorageLocation({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: StorageLocation,
    entityType: 'StorageLocation',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  listStorageLocations,
  getStorageLocation,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
  restoreStorageLocation,
};
