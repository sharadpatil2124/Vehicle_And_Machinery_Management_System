const { Op } = require('sequelize');

const { sequelize, UnitOfMeasure, Item } = require('../models');
const AppError = require('../utils/AppError');
const { requireText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(UnitOfMeasure);

const SORTABLE_FIELDS = ['createdAt', 'uomName'];
const DEFAULT_SORT = 'uomName:asc';

const UOM_CODE_PREFIX = 'UOM-';
const UOM_CODE_GENERATION_ATTEMPTS = 5;

function toPublic(uom) {
  return uom.toPublicJSON();
}

function readUnitOfMeasureInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.uomName !== undefined) {
    input.uomName = requireText(payload.uomName, 'Unit name', { max: 150 });
  }

  return input;
}

async function listUnitsOfMeasure({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, UnitOfMeasure.STATUSES, 'Status') ?? 'active';
  const where = { status };

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.uomName = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getUnitOfMeasure({ tenantId, id }) {
  const uom = await repo.findByPk(tenantId, id);
  if (!uom) throw AppError.notFound('Unit of measure not found');
  return toPublic(uom);
}

async function createUnitOfMeasure({ tenantId, actingUserId, payload }) {
  const input = readUnitOfMeasureInput(payload);

  const uom = await sequelize.transaction(async (transaction) => {
    let created;

    for (let attempt = 1; attempt <= UOM_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const uomCode = await nextSequentialCode(UnitOfMeasure, 'uomCode', UOM_CODE_PREFIX, { tenantId, transaction });
      try {
        created = await repo.create(
          tenantId,
          { ...input, uomCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === UOM_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_units_of_measure_tenant_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'UnitOfMeasure', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(uom);
}

async function updateUnitOfMeasure({ tenantId, actingUserId, id, payload }) {
  const uom = await repo.findByPk(tenantId, id);
  if (!uom) throw AppError.notFound('Unit of measure not found');

  const input = readUnitOfMeasureInput(payload, { partial: true });

  const before = uom.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await uom.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'UnitOfMeasure', entityId: uom.id, performedBy: actingUserId, before, after: uom },
      { transaction }
    );

    return uom;
  });

  return toPublic(updated);
}

async function deleteUnitOfMeasure({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: UnitOfMeasure,
    entityType: 'UnitOfMeasure',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
    dependencyCheck: async (uom, { transaction }) => {
      const activeItemCount = await Item.count({
        where: { tenantId, baseUomId: uom.id, status: 'active' },
        transaction,
      });
      if (activeItemCount > 0) {
        throw AppError.conflict(
          'This unit is still used as the base unit for active items. Update those items first.'
        );
      }
    },
  });

  return toPublic(archived);
}

async function restoreUnitOfMeasure({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: UnitOfMeasure,
    entityType: 'UnitOfMeasure',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  listUnitsOfMeasure,
  getUnitOfMeasure,
  createUnitOfMeasure,
  updateUnitOfMeasure,
  deleteUnitOfMeasure,
  restoreUnitOfMeasure,
};
