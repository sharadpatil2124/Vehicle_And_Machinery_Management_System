const { Op } = require('sequelize');

const {
  sequelize,
  Item,
  ItemCategory,
  UnitOfMeasure,
  StockBalance,
  InventoryTransaction,
  Purchase,
  PurchaseItem,
  StockTransfer,
  StockTransferItem,
} = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber, requireIdFilter } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');
const { assertEditable, assertNameAvailable } = require('./masterData');

const repo = createTenantScopedRepository(Item);

const SORTABLE_FIELDS = ['createdAt', 'itemName'];
const DEFAULT_SORT = 'itemName:asc';

const ITEM_CODE_PREFIX = 'ITM-';
const ITEM_CODE_GENERATION_ATTEMPTS = 5;

const NAME_RULE = { model: Item, field: 'itemName', codePrefix: ITEM_CODE_PREFIX, label: 'An item' };
const LEVEL_FIELDS = ['minimumStockLevel', 'reorderLevel', 'maximumStockLevel'];

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
  if (!partial || payload.minimumStockLevel !== undefined) {
    input.minimumStockLevel = optionalNumber(payload.minimumStockLevel, 'Minimum stock level', { min: 0 });
  }
  if (!partial || payload.reorderLevel !== undefined) {
    input.reorderLevel = optionalNumber(payload.reorderLevel, 'Reorder level', { min: 0 });
  }
  if (!partial || payload.maximumStockLevel !== undefined) {
    input.maximumStockLevel = optionalNumber(payload.maximumStockLevel, 'Maximum stock level', { min: 0 });
  }

  return input;
}

function assertLevelsInOrder({ minimumStockLevel: minimum, reorderLevel: reorder, maximumStockLevel: maximum }) {
  if (minimum != null && maximum != null && maximum < minimum) {
    throw AppError.badRequest('Maximum stock level cannot be less than the minimum stock level');
  }
  if (minimum != null && reorder != null && reorder < minimum) {
    throw AppError.badRequest('Reorder level cannot be less than the minimum stock level');
  }
  if (maximum != null && reorder != null && reorder > maximum) {
    throw AppError.badRequest('Reorder level cannot be more than the maximum stock level');
  }
}

const storedLevel = (item, field) => (item[field] == null ? null : Number(item[field]));

// A request may send only some levels, so the others come from the item. Levels left as they were never block a save.
function assertChangedLevelsInOrder(item, input) {
  const changed = LEVEL_FIELDS.some((field) => input[field] !== undefined && input[field] !== storedLevel(item, field));
  if (!changed) return;

  const levels = {};
  for (const field of LEVEL_FIELDS) levels[field] = input[field] !== undefined ? input[field] : storedLevel(item, field);
  assertLevelsInOrder(levels);
}

async function assertCategoryUsable(tenantId, categoryId, transaction) {
  // The shared lock makes an archive of this category wait until this save has finished, so it sees the item.
  const category = await ItemCategory.findOne({ where: { tenantId, id: categoryId }, transaction, lock: transaction.LOCK.SHARE });
  if (!category) throw AppError.badRequest('Category not found');
  if (category.status !== 'active') throw AppError.badRequest('Category is archived and cannot be used');
}

async function assertUomUsable(tenantId, uomId, transaction) {
  const uom = await UnitOfMeasure.findOne({ where: { tenantId, id: uomId }, transaction, lock: transaction.LOCK.SHARE });
  if (!uom) throw AppError.badRequest('Unit of measure not found');
  if (uom.status !== 'active') throw AppError.badRequest('Unit of measure is archived and cannot be used');
}

async function isOnDraftPurchase(tenantId, itemId, transaction) {
  const lines = await PurchaseItem.count({
    where: { tenantId, itemId },
    include: [{ model: Purchase, as: 'purchase', attributes: [], required: true, where: { status: 'draft' } }],
    transaction,
  });
  return lines > 0;
}

async function isOnTransferInTransit(tenantId, itemId, transaction) {
  const lines = await StockTransferItem.count({
    where: { tenantId, itemId },
    include: [{ model: StockTransfer, as: 'stockTransfer', attributes: [], required: true, where: { status: 'in_transit' } }],
    transaction,
  });
  return lines > 0;
}

// Past quantities were counted in the old unit, so a new unit would make them wrong.
async function assertUnitCanChange(tenantId, itemId, transaction) {
  const movements = await InventoryTransaction.count({ where: { tenantId, itemId }, transaction });
  if (movements > 0 || (await isOnDraftPurchase(tenantId, itemId, transaction))) {
    throw AppError.conflict("This item already has stock movements or a draft purchase, so its unit can't change. Create a new item for a different unit.");
  }
}

async function assertItemHasNoOpenStock(item, { transaction }) {
  const { tenantId, id: itemId } = item;
  const onHand = await StockBalance.sum('quantityOnHand', { where: { tenantId, itemId }, transaction });
  if (Number(onHand) > 0) {
    throw AppError.conflict('This item still has stock. Issue, transfer or adjust it down to zero first.');
  }
  if (await isOnDraftPurchase(tenantId, itemId, transaction)) {
    throw AppError.conflict('This item is on a draft purchase. Receive that purchase or take the item off it first.');
  }
  if (await isOnTransferInTransit(tenantId, itemId, transaction)) {
    throw AppError.conflict('This item is on a stock transfer that has not been received yet. Receive the transfer first.');
  }
}

async function assertParentsActive(item, { transaction }) {
  const { tenantId } = item;
  const category = await ItemCategory.findOne({ where: { tenantId, id: item.categoryId }, transaction, lock: transaction.LOCK.SHARE });
  if (category.status !== 'active') {
    throw AppError.badRequest(`The category "${category.categoryName}" is archived. Restore it first.`);
  }
  const uom = await UnitOfMeasure.findOne({ where: { tenantId, id: item.baseUomId }, transaction, lock: transaction.LOCK.SHARE });
  if (uom.status !== 'active') {
    throw AppError.badRequest(`The unit "${uom.uomName}" is archived. Restore it first.`);
  }
}

async function listItems({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Item.STATUSES, 'Status') ?? 'active';
  const where = { status };
  if (query.categoryId) where.categoryId = requireIdFilter(query.categoryId, 'Category');

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.itemName = { [Op.like]: containsPattern(search) };
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
  assertLevelsInOrder(input);

  const item = await sequelize.transaction(async (transaction) => {
    await assertNameAvailable(NAME_RULE, { tenantId, name: input.itemName, transaction });
    await assertCategoryUsable(tenantId, input.categoryId, transaction);
    await assertUomUsable(tenantId, input.baseUomId, transaction);

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
  const updated = await sequelize.transaction(async (transaction) => {
    const item = await repo.findByPk(tenantId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw AppError.notFound('Item not found');
    assertEditable(item, 'item');

    const input = readItemInput(payload, { partial: true });
    assertChangedLevelsInOrder(item, input);

    if (input.itemName !== undefined && input.itemName !== item.itemName) {
      await assertNameAvailable(NAME_RULE, { tenantId, name: input.itemName, excludeId: item.id, transaction });
    }
    // Only a new category or unit is checked: an item may keep one that was archived after it was chosen.
    if (input.categoryId !== undefined && input.categoryId !== item.categoryId) {
      await assertCategoryUsable(tenantId, input.categoryId, transaction);
    }
    if (input.baseUomId !== undefined && input.baseUomId !== item.baseUomId) {
      await assertUomUsable(tenantId, input.baseUomId, transaction);
      await assertUnitCanChange(tenantId, item.id, transaction);
    }

    const before = item.toJSON();
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
    dependencyCheck: assertItemHasNoOpenStock,
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
    dependencyCheck: async (item, { transaction }) => {
      await assertNameAvailable(NAME_RULE, { tenantId, name: item.itemName, excludeId: item.id, transaction });
      await assertParentsActive(item, { transaction });
    },
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
