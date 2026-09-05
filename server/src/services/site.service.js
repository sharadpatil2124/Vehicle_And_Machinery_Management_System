const { Op } = require('sequelize');

const { sequelize, Site } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');

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

async function listSites({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Site.STATUSES, 'Status') ?? 'active';
  const where = { status };

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getSite({ tenantId, id }) {
  const site = await repo.findByPk(tenantId, id);
  if (!site) throw AppError.notFound('Site not found');
  return toPublic(site);
}

async function assertSiteAssignable(tenantId, siteId) {
  const site = await Site.findOne({ where: { tenantId, id: siteId } });
  if (!site) throw AppError.badRequest('Site not found');
  if (site.status !== 'active') throw AppError.badRequest('Site is archived and cannot be assigned');
  return site;
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

async function updateSite({ tenantId, actingUserId, id, payload }) {
  const site = await repo.findByPk(tenantId, id);
  if (!site) throw AppError.notFound('Site not found');

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

module.exports = {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
  assertSiteAssignable,
};
