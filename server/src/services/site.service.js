const { Op } = require('sequelize');

const { sequelize, Site, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed } = require('./siteAccess');

const repo = createTenantScopedRepository(Site);

const SORTABLE_FIELDS = ['createdAt', 'name'];
const DEFAULT_SORT = 'name:asc';

function toPublic(site) {
  return site.toPublicJSON();
}

function readSiteInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.name !== undefined) {
    input.name = requireText(payload.name, 'Name', { max: 150 });
  }
  if (!partial || payload.location !== undefined) {
    input.location = optionalText(payload.location, 'Location', { max: 255 });
  }

  return input;
}

async function listSites({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Site.STATUSES, 'Status') ?? 'active';
  // A Supervisor sees only the one site assigned to them. Here the site's own
  // primary key is the column to match on, not `currentSiteId`.
  const where = scopeToSite({ status }, auth, 'id');

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getSite({ tenantId, auth, id }) {
  const site = await repo.findByPk(tenantId, id);
  if (!site) throw AppError.notFound('Site not found');
  assertSiteAllowed(auth, site.id, 'Site not found');
  return toPublic(site);
}

async function assertSiteAssignable(tenantId, siteId) {
  const site = await Site.findOne({ where: { tenantId, id: siteId } });
  if (!site) throw AppError.badRequest('Site not found');
  if (site.status !== 'active') throw AppError.badRequest('Site is archived and cannot be assigned');
  return site;
}

async function listAssetsAtSite({ tenantId, auth, siteId }) {
  const site = await repo.findByPk(tenantId, siteId);
  if (!site) throw AppError.notFound('Site not found');
  assertSiteAllowed(auth, site.id, 'Site not found');

  const [vehicles, machinery] = await Promise.all([
    Vehicle.findAll({ where: { tenantId, currentSiteId: siteId, status: 'active' } }),
    Machinery.findAll({ where: { tenantId, currentSiteId: siteId, status: 'active' } }),
  ]);

  return [
    ...vehicles.map((vehicle) => ({ assetType: 'VEHICLE', ...vehicle.toPublicJSON() })),
    ...machinery.map((machine) => ({ assetType: 'MACHINERY', ...machine.toPublicJSON() })),
  ];
}

async function createSite({ tenantId, actingUserId, payload }) {
  const input = readSiteInput(payload);

  const site = await sequelize.transaction(async (transaction) => {
    const created = await repo.create(
      tenantId,
      { ...input, createdBy: actingUserId, updatedBy: actingUserId },
      { transaction }
    );

    await recordCreate(
      { tenantId, entityType: 'Site', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(site);
}

async function updateSite({ tenantId, auth, actingUserId, id, payload }) {
  const site = await repo.findByPk(tenantId, id);
  if (!site) throw AppError.notFound('Site not found');
  assertSiteAllowed(auth, site.id, 'Site not found');

  const input = readSiteInput(payload, { partial: true });

  const before = site.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await site.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'Site', entityId: site.id, performedBy: actingUserId, before, after: site },
      { transaction }
    );

    return site;
  });

  return toPublic(updated);
}

async function deleteSite({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Site,
    entityType: 'Site',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreSite({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: Site,
    entityType: 'Site',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  listSites,
  getSite,
  listAssetsAtSite,
  createSite,
  updateSite,
  deleteSite,
  restoreSite,
  assertSiteAssignable,
};
