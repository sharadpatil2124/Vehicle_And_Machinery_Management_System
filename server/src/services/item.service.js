const { Op } = require('sequelize');

const { sequelize, Item, ItemCategory, UnitOfMeasure } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(Item);

const SORTABLE_FIELDS = ['createdAt', 'itemName'];
const DEFAULT_SORT = 'itemName:asc';

const ITEM_CODE_PREFIX = 'ITM-';
const ITEM_CODE_GENERATION_ATTEMPTS = 5;

function toPublic(item) {
  return item.toPublicJSON();
}

function readItemInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.itemName !== undefined) {
    input.itemName = requireText(payload.itemName, 'Item name', { max: 255 });
  }
  if (!partial || payload.categoryId !== undefined) {
    input.categoryId = requireNumber(payload.categoryId, 'Category', { min: 1 });
  }
  if (!partial || payload.baseUomId !== undefined) {
    input.baseUomId = requireNumber(payload.baseUomId, 'Base unit of measure', { min: 1 });
  }
  if (!partial || payload.description !== undefined) {
    input.description = optionalText(payload.description, 'Description', { max: 2000 });
  }
  if (!partial || payload.itemType !== undefined) {
    input.itemType = optionalText(payload.itemType, 'Item type', { max: 50 });
  }
  if (!partial || payload.isHazardous !== undefined) {
    input.isHazardous = Boolean(payload.isHazardous);
  }
  if (!partial || payload.batchTrackingRequired !== undefined) {
    input.batchTrackingRequired = Boolean(payload.batchTrackingRequired);
  }
  if (!partial || payload.minimumStockLevel !== undefined) {
    input.minimumStockLevel = optionalNumber(payload.minimumStockLevel, 'Minimum stock level', { min: 0 });
  }
  if (!partial || payload.reorderLevel !== undefined) {
    input.reorderLevel = optionalNumber(payload.reorderLevel, 'Reorder level', { min: 0 });
  }
  if (!partial || payload.maximumStockLevel !== undefined) {
    input.maximumStockLevel = optionalNumber(payload.maximumStockLevel, 'Maximum stock level', { min: 0 });
  }

  if (input.minimumStockLevel != null && input.maximumStockLevel != null) {
    if (input.maximumStockLevel < input.minimumStockLevel) {
      throw AppError.badRequest('Maximum stock level cannot be less than the minimum stock level');
    }
  }

  return input;
}

async function assertCategoryUsable(tenantId, categoryId) {
  const category = await ItemCategory.findOne({ where: { tenantId, id: categoryId } });
  if (!category) throw AppError.badRequest('Category not found');
  if (category.status !== 'active') throw AppError.badRequest('Category is archived and cannot be used');
}

async function assertUomUsable(tenantId, uomId) {
  const uom = await UnitOfMeasure.findOne({ where: { tenantId, id: uomId } });
  if (!uom) throw AppError.badRequest('Unit of measure not found');
  if (uom.status !== 'active') throw AppError.badRequest('Unit of measure is archived and cannot be used');
}

async function listItems({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Item.STATUSES, 'Status') ?? 'active';
  const where = { status };
  if (query.categoryId) where.categoryId = Number(query.categoryId);

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.itemName = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getItem({ tenantId, id }) {
  const item = await repo.findByPk(tenantId, id);
  if (!item) throw AppError.notFound('Item not found');
  return toPublic(item);
}

async function createItem({ tenantId, actingUserId, payload }) {
  const input = readItemInput(payload);

  await assertCategoryUsable(tenantId, input.categoryId);
  await assertUomUsable(tenantId, input.baseUomId);

  const item = await sequelize.transaction(async (transaction) => {
    let created;

    for (let attempt = 1; attempt <= ITEM_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const itemCode = await nextSequentialCode(Item, 'itemCode', ITEM_CODE_PREFIX, { tenantId, transaction });
      try {
        created = await repo.create(
          tenantId,
          { ...input, itemCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === ITEM_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_items_tenant_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'Item', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(item);
}

async function updateItem({ tenantId, actingUserId, id, payload }) {
  const item = await repo.findByPk(tenantId, id);
  if (!item) throw AppError.notFound('Item not found');

  const input = readItemInput(payload, { partial: true });

  if (input.categoryId !== undefined) await assertCategoryUsable(tenantId, input.categoryId);
  if (input.baseUomId !== undefined) await assertUomUsable(tenantId, input.baseUomId);

  const before = item.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await item.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'Item', entityId: item.id, performedBy: actingUserId, before, after: item },
      { transaction }
    );

    return item;
  });

  return toPublic(updated);
}

async function deleteItem({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Item,
    entityType: 'Item',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreItem({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: Item,
    entityType: 'Item',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
};
