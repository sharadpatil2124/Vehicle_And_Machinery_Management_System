const { Op } = require('sequelize');

const {
  sequelize,
  StockAdjustment,
  StockAdjustmentItem,
  Item,
  StorageLocation,
  StockBalance,
} = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { postInventoryTransaction } = require('./inventoryTransaction.service');
const { latestUnitCost } = require('./stockBatch.service');

const repo = createTenantScopedRepository(StockAdjustment);

const SORTABLE_FIELDS = ['createdAt', 'adjustmentDate', 'adjustmentNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const ADJUSTMENT_NUMBER_PREFIX = 'ADJ-';
const ADJUSTMENT_NUMBER_GENERATION_ATTEMPTS = 5;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireDateOnly(value, label) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

function toPublic(adjustment) {
  const json = adjustment.toPublicJSON();
  if (adjustment.items) json.items = adjustment.items.map((line) => line.toPublicJSON());
  return json;
}

async function generateAdjustmentNumber(tenantId, { transaction } = {}) {
  const highest = await StockAdjustment.max('adjustmentNumber', { where: { tenantId }, transaction });
  const nextNumber = highest ? Number(highest.slice(ADJUSTMENT_NUMBER_PREFIX.length)) + 1 : 1;
  return `${ADJUSTMENT_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isAdjustmentNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_stock_adjustments_tenant_number')
  );
}

function readAdjustmentInput(payload) {
  return {
    adjustmentDate: requireDateOnly(payload.adjustmentDate, 'Adjustment date'),
    reason: optionalText(payload.reason, 'Reason', { max: 2000 }),
  };
}

function readAdjustmentItemInput(raw, index) {
  const label = `Item ${index + 1}`;
  return {
    itemId: requireNumber(raw?.itemId, `${label}: item`, { min: 1 }),
    storageLocationId: requireNumber(raw?.storageLocationId, `${label}: storage location`, { min: 1 }),
    countedQuantity: requireNumber(raw?.countedQuantity, `${label}: counted quantity`, { min: 0 }),
  };
}

function readAdjustmentItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }
  return rawItems.map(readAdjustmentItemInput);
}

async function assertItemUsable(tenantId, itemId) {
  const item = await Item.findOne({ where: { tenantId, id: itemId } });
  if (!item) throw AppError.badRequest('Item not found');
  if (item.status !== 'active') throw AppError.badRequest('Item is archived and cannot be used');
  return item;
}

async function assertStorageLocationUsable(tenantId, storageLocationId, siteId) {
  const location = await StorageLocation.findOne({ where: { tenantId, id: storageLocationId } });
  if (!location) throw AppError.badRequest('Storage location not found');
  if (location.status !== 'active') throw AppError.badRequest('Storage location is archived and cannot be used');
  if (Number(location.siteId) !== Number(siteId)) {
    throw AppError.badRequest('Storage location does not belong to this site');
  }
  return location;
}

async function listStockAdjustments({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const where = scopeToSite({}, auth, 'siteId');
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.adjustmentNumber = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getStockAdjustment({ tenantId, auth, id }) {
  const adjustment = await repo.findByPk(tenantId, id, { include: [{ model: StockAdjustmentItem, as: 'items' }] });
  if (!adjustment) throw AppError.notFound('Stock adjustment not found');
  assertSiteAllowed(auth, adjustment.siteId, 'Stock adjustment not found');
  return toPublic(adjustment);
}

async function createStockAdjustment({ tenantId, auth, actingUserId, payload }) {
  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId !== null ? ownSiteId : optionalNumber(payload.siteId, 'Site', { min: 1 });
  if (siteId == null) throw AppError.badRequest('Site is required');

  const input = readAdjustmentInput(payload);
  const itemsInput = readAdjustmentItemsInput(payload.items);

  const lines = [];
  for (const [index, line] of itemsInput.entries()) {
    const item = await assertItemUsable(tenantId, line.itemId);
    await assertStorageLocationUsable(tenantId, line.storageLocationId, siteId);

    const availableAtSite = await StockBalance.sum('availableQuantity', {
      where: { tenantId, siteId, itemId: line.itemId },
    });
    if (!(Number(availableAtSite) > 0)) {
      throw AppError.badRequest(`Item ${index + 1}: this item has no available stock at the selected site`);
    }

    const balance = await StockBalance.findOne({
      where: { tenantId, siteId, itemId: line.itemId, storageLocationId: line.storageLocationId },
    });
    const systemQuantity = balance ? Number(balance.quantityOnHand) : 0;
    const adjustmentQuantity = Math.round((line.countedQuantity - systemQuantity) * 1000) / 1000;
    const unitCost =
      adjustmentQuantity > 0
        ? await latestUnitCost({ tenantId, siteId, itemId: line.itemId, storageLocationId: line.storageLocationId })
        : balance
          ? Number(balance.averageUnitCost)
          : 0;

    lines.push({
      itemId: line.itemId,
      storageLocationId: line.storageLocationId,
      uomId: item.baseUomId,
      systemQuantity,
      countedQuantity: line.countedQuantity,
      adjustmentQuantity,
      unitCost,
    });
  }

  const adjustment = await sequelize.transaction(async (transaction) => {
    let created;
    for (let attempt = 1; attempt <= ADJUSTMENT_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const adjustmentNumber = await generateAdjustmentNumber(tenantId, { transaction });
      try {
        created = await repo.create(
          tenantId,
          { siteId, ...input, adjustmentNumber, requestedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === ADJUSTMENT_NUMBER_GENERATION_ATTEMPTS;
        if (!isAdjustmentNumberCollision(error) || isLastAttempt) throw error;
      }
    }

    for (const line of lines) {
      const adjustmentItem = await StockAdjustmentItem.create(
        { tenantId, adjustmentId: created.id, ...line },
        { transaction }
      );

      if (line.adjustmentQuantity === 0) continue;

      const posted = await postInventoryTransaction({
        tenantId,
        siteId,
        itemId: line.itemId,
        storageLocationId: line.storageLocationId,
        uomId: line.uomId,
        transactionType: 'ADJUSTMENT',
        direction: line.adjustmentQuantity > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(line.adjustmentQuantity),
        unitCost: line.unitCost,
        referenceType: 'STOCK_ADJUSTMENT_ITEM',
        referenceId: adjustmentItem.id,
        createdBy: actingUserId,
        transaction,
      });

      await adjustmentItem.update(
        { inventoryTransactionId: posted.id, unitCost: Number(posted.unitCost) },
        { transaction }
      );
    }

    await recordCreate(
      { tenantId, entityType: 'StockAdjustment', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return getStockAdjustment({ tenantId, auth, id: adjustment.id });
}

module.exports = {
  listStockAdjustments,
  getStockAdjustment,
  createStockAdjustment,
};
