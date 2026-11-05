const { Op } = require('sequelize');

const { sequelize, ItemCategory, Item } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');
const { assertEditable, assertNameAvailable } = require('./masterData');

const repo = createTenantScopedRepository(ItemCategory);

const SORTABLE_FIELDS = ['createdAt', 'categoryName'];
const DEFAULT_SORT = 'categoryName:asc';

const CATEGORY_CODE_PREFIX = 'CAT-';
const CATEGORY_CODE_GENERATION_ATTEMPTS = 5;

const NAME_RULE = { model: ItemCategory, field: 'categoryName', codePrefix: CATEGORY_CODE_PREFIX, label: 'A category' };

function toPublic(category) {
  return category.toPublicJSON();
}

function readItemCategoryInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.categoryName !== undefined) {
    input.categoryName = requireText(payload.categoryName, 'Category name', { max: 150 });
  }
  if (!partial || payload.inventoryType !== undefined) {
    input.inventoryType = optionalText(payload.inventoryType, 'Inventory type', { max: 50 });
  }

  return input;
}

async function listItemCategories({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, ItemCategory.STATUSES, 'Status') ?? 'active';
  const where = { status };

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.categoryName = { [Op.like]: containsPattern(search) };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getItemCategory({ tenantId, id }) {
  const category = await repo.findByPk(tenantId, id);
  if (!category) throw AppError.notFound('Item category not found');
  return toPublic(category);
}

async function createItemCategory({ tenantId, actingUserId, payload }) {
  const input = readItemCategoryInput(payload);

  const category = await sequelize.transaction(async (transaction) => {
    await assertNameAvailable(NAME_RULE, { tenantId, name: input.categoryName, transaction });

    let created;

    for (let attempt = 1; attempt <= CATEGORY_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const categoryCode = await nextSequentialCode(ItemCategory, 'categoryCode', CATEGORY_CODE_PREFIX, {
        tenantId,
        transaction,
      });
      try {
        created = await repo.create(
          tenantId,
          { ...input, categoryCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === CATEGORY_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_item_categories_tenant_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'ItemCategory', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(category);
}

async function updateItemCategory({ tenantId, actingUserId, id, payload }) {
  const updated = await sequelize.transaction(async (transaction) => {
    const category = await repo.findByPk(tenantId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!category) throw AppError.notFound('Item category not found');
    assertEditable(category, 'category');

    const input = readItemCategoryInput(payload, { partial: true });
    if (input.categoryName !== undefined && input.categoryName !== category.categoryName) {
      await assertNameAvailable(NAME_RULE, { tenantId, name: input.categoryName, excludeId: category.id, transaction });
    }

    const before = category.toJSON();
    await category.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'ItemCategory', entityId: category.id, performedBy: actingUserId, before, after: category },
      { transaction }
    );

    return category;
  });

  return toPublic(updated);
}

async function deleteItemCategory({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: ItemCategory,
    entityType: 'ItemCategory',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
    dependencyCheck: async (category, { transaction }) => {
      const activeItemCount = await Item.count({
        where: { tenantId, categoryId: category.id, status: 'active' },
        transaction,
      });
      if (activeItemCount > 0) {
        throw AppError.conflict(
          'This category still has active items assigned to it. Move or archive them first.'
        );
      }
    },
  });

  return toPublic(archived);
}

async function restoreItemCategory({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: ItemCategory,
    entityType: 'ItemCategory',
    tenantId,
    id,
    performedBy: actingUserId,
    dependencyCheck: (category, { transaction }) =>
      assertNameAvailable(NAME_RULE, { tenantId, name: category.categoryName, excludeId: category.id, transaction }),
  });

  return toPublic(restored);
}

module.exports = {
  listItemCategories,
  getItemCategory,
  createItemCategory,
  updateItemCategory,
  deleteItemCategory,
  restoreItemCategory,
};
