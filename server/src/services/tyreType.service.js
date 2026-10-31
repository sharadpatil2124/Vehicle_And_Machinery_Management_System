const { Op } = require('sequelize');

const { sequelize, TyreType } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(TyreType);
const CODE_PREFIX = 'TT-';
const CODE_ATTEMPTS = 5;

function readInput(payload) {
  return {
    brand: requireText(payload.brand, 'Brand', { max: 100 }),
    pattern: optionalText(payload.pattern, 'Pattern / model', { max: 100 }) ?? '',
    size: requireText(payload.size, 'Size', { max: 50 }).toUpperCase(),
  };
}

async function assertUnique(tenantId, input, excludeId = null) {
  const where = { tenantId, brand: input.brand, pattern: input.pattern, size: input.size };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await TyreType.findOne({ where });
  if (existing) {
    throw AppError.conflict(`This tyre type already exists (${existing.typeCode}). Choose it from the list instead.`);
  }
}

async function listTyreTypes({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, { sortableFields: ['brand', 'size', 'typeCode', 'createdAt'], defaultSort: 'brand:asc' });
  const status = parseEnumFilter(query.status, TyreType.STATUSES, 'Status') ?? 'active';
  const where = { status };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: containsPattern(search) };
    where[Op.or] = [{ brand: like }, { pattern: like }, { size: like }, { typeCode: like }];
  }
  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order: [...order, ['size', 'ASC'], ['id', 'ASC']], limit, offset });
  return buildListResponse(rows.map((r) => r.toPublicJSON()), { page, limit, total: count });
}

async function createTyreType({ tenantId, actingUserId, payload }) {
  const input = readInput(payload);
  await assertUnique(tenantId, input);

  const created = await sequelize.transaction(async (transaction) => {
    let record;
    for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt += 1) {
      const typeCode = await nextSequentialCode(TyreType, 'typeCode', CODE_PREFIX, { tenantId, transaction });
      try {
        record = await repo.create(tenantId, { ...input, typeCode, createdBy: actingUserId, updatedBy: actingUserId }, { transaction });
        break;
      } catch (error) {
        if (isCodeCollision(error, 'uq_tyre_types_tenant_brand_pattern_size')) {
          throw AppError.conflict('This tyre type already exists. Choose it from the list instead.');
        }
        if (!isCodeCollision(error, 'uq_tyre_types_tenant_code') || attempt === CODE_ATTEMPTS) throw error;
      }
    }
    await recordCreate({ tenantId, entityType: 'TyreType', entityId: record.id, performedBy: actingUserId, after: record }, { transaction });
    return record;
  });

  return created.toPublicJSON();
}

async function updateTyreType({ tenantId, actingUserId, id, payload }) {
  const record = await repo.findByPk(tenantId, id);
  if (!record) throw AppError.notFound('Tyre type not found');
  const input = readInput(payload);
  await assertUnique(tenantId, input, record.id);

  const before = record.toJSON();
  await sequelize.transaction(async (transaction) => {
    await record.update({ ...input, updatedBy: actingUserId }, { transaction });
    await recordUpdate({ tenantId, entityType: 'TyreType', entityId: record.id, performedBy: actingUserId, before, after: record }, { transaction });
  });
  return record.toPublicJSON();
}

module.exports = { listTyreTypes, createTyreType, updateTyreType };
