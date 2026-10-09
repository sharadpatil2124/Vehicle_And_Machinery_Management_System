const { Op } = require('sequelize');

const { sequelize, Purchase, PurchaseItem, Item, Supplier, StorageLocation } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { postInventoryTransaction } = require('./inventoryTransaction.service');

const repo = createTenantScopedRepository(Purchase);

const SORTABLE_FIELDS = ['createdAt', 'purchaseDate', 'purchaseNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const PURCHASE_NUMBER_PREFIX = 'PO-';
const PURCHASE_NUMBER_GENERATION_ATTEMPTS = 5;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireDateOnly(value, label) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

function toPublic(purchase) {
  const json = purchase.toPublicJSON();
  if (purchase.items) {
    json.items = purchase.items.map((line) => line.toPublicJSON());
  }
  return json;
}

async function generatePurchaseNumber(tenantId, { transaction } = {}) {
  const highest = await Purchase.max('purchaseNumber', { where: { tenantId }, transaction });
  const nextNumber = highest ? Number(highest.slice(PURCHASE_NUMBER_PREFIX.length)) + 1 : 1;
  return `${PURCHASE_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isPurchaseNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_purchases_tenant_number')
  );
}

function readPurchaseInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.supplierId !== undefined) {
    input.supplierId = requireNumber(payload.supplierId, 'Supplier', { min: 1 });
  }
  if (!partial || payload.purchaseDate !== undefined) {
    input.purchaseDate = requireDateOnly(payload.purchaseDate, 'Purchase date');
  }
  if (!partial || payload.remarks !== undefined) {
    input.remarks = optionalText(payload.remarks, 'Remarks', { max: 2000 });
  }

  return input;
}

function readPurchaseItemInput(raw, index) {
  const label = `Item ${index + 1}`;
  const itemId = requireNumber(raw?.itemId, `${label}: item`, { min: 1 });
  const storageLocationId = requireNumber(raw?.storageLocationId, `${label}: storage location`, { min: 1 });
  const purchasedQuantity = requireNumber(raw?.purchasedQuantity, `${label}: purchased quantity`, { min: 0.001 });
  const unitPrice = requireNumber(raw?.unitPrice, `${label}: unit price`, { min: 0 });
  const taxPercentage = optionalNumber(raw?.taxPercentage, `${label}: tax percentage`, { min: 0 }) ?? 0;
  const batchNumber = optionalText(raw?.batchNumber, `${label}: batch number`, { max: 64 });
  const expiryDate = raw?.expiryDate ? requireDateOnly(raw.expiryDate, `${label}: expiry date`) : null;

  return { itemId, storageLocationId, purchasedQuantity, unitPrice, taxPercentage, batchNumber, expiryDate };
}

function readPurchaseItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }
  return rawItems.map(readPurchaseItemInput);
}

function computeLineAmounts({ purchasedQuantity, unitPrice, taxPercentage }) {
  const subtotal = purchasedQuantity * unitPrice;
  const taxAmount = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
  const lineTotalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, lineTotalAmount };
}

async function assertSupplierUsable(tenantId, supplierId) {
  const supplier = await Supplier.findOne({ where: { tenantId, id: supplierId } });
  if (!supplier) throw AppError.badRequest('Supplier not found');
  if (supplier.status !== 'active') throw AppError.badRequest('Supplier is archived and cannot be used');
  return supplier;
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
    throw AppError.badRequest('Storage location does not belong to this purchase\'s site');
  }
  return location;
}

async function buildValidatedLines(tenantId, siteId, itemsInput) {
  const lines = [];
  for (const line of itemsInput) {
    const item = await assertItemUsable(tenantId, line.itemId);
    await assertStorageLocationUsable(tenantId, line.storageLocationId, siteId);
    const { taxAmount, lineTotalAmount } = computeLineAmounts(line);
    lines.push({
      itemId: line.itemId,
      storageLocationId: line.storageLocationId,
      uomId: item.baseUomId,
      purchasedQuantity: line.purchasedQuantity,
      unitPrice: line.unitPrice,
      taxPercentage: line.taxPercentage,
      taxAmount,
      lineTotalAmount,
      batchNumber: line.batchNumber,
      expiryDate: line.expiryDate,
    });
  }
  return lines;
}

function sumPurchaseTotals(lines) {
  const subtotalAmount = lines.reduce((sum, l) => sum + (l.lineTotalAmount - l.taxAmount), 0);
  const taxAmount = lines.reduce((sum, l) => sum + l.taxAmount, 0);
  const totalAmount = lines.reduce((sum, l) => sum + l.lineTotalAmount, 0);
  return {
    subtotalAmount: Math.round(subtotalAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

async function listPurchases({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const where = scopeToSite({}, auth, 'siteId');
  const status = parseEnumFilter(query.status, Purchase.STATUSES, 'Status');
  if (status) where.status = status;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.purchaseNumber = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getPurchase({ tenantId, auth, id }) {
  const purchase = await repo.findByPk(tenantId, id, { include: [{ model: PurchaseItem, as: 'items' }] });
  if (!purchase) throw AppError.notFound('Purchase not found');
  assertSiteAllowed(auth, purchase.siteId, 'Purchase not found');
  return toPublic(purchase);
}

async function createPurchase({ tenantId, auth, actingUserId, payload }) {
  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId !== null ? ownSiteId : optionalNumber(payload.siteId, 'Site', { min: 1 });
  if (siteId == null) throw AppError.badRequest('Site is required');
  await assertSiteAssignable(tenantId, siteId);

  const input = readPurchaseInput(payload);
  await assertSupplierUsable(tenantId, input.supplierId);

  const itemsInput = readPurchaseItemsInput(payload.items);
  const lines = await buildValidatedLines(tenantId, siteId, itemsInput);
  const totals = sumPurchaseTotals(lines);

  const purchase = await sequelize.transaction(async (transaction) => {
    let created;
    for (let attempt = 1; attempt <= PURCHASE_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const purchaseNumber = await generatePurchaseNumber(tenantId, { transaction });
      try {
        created = await repo.create(
          tenantId,
          {
            siteId,
            ...input,
            ...totals,
            purchaseNumber,
            status: 'draft',
            createdBy: actingUserId,
            updatedBy: actingUserId,
          },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === PURCHASE_NUMBER_GENERATION_ATTEMPTS;
        if (!isPurchaseNumberCollision(error) || isLastAttempt) throw error;
      }
    }

    for (const line of lines) {
      await PurchaseItem.create(
        { tenantId, purchaseId: created.id, ...line },
        { transaction }
      );
    }

    await recordCreate(
      { tenantId, entityType: 'Purchase', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return getPurchase({ tenantId, auth, id: purchase.id });
}

async function updatePurchase({ tenantId, auth, actingUserId, id, payload }) {
  const purchase = await repo.findByPk(tenantId, id);
  if (!purchase) throw AppError.notFound('Purchase not found');
  assertSiteAllowed(auth, purchase.siteId, 'Purchase not found');

  if (purchase.status !== 'draft') {
    throw AppError.conflict('This purchase has already been received and can no longer be edited');
  }

  const input = readPurchaseInput(payload, { partial: true });
  if (input.supplierId !== undefined) await assertSupplierUsable(tenantId, input.supplierId);

  const hasNewItems = payload.items !== undefined;
  const lines = hasNewItems
    ? await buildValidatedLines(tenantId, purchase.siteId, readPurchaseItemsInput(payload.items))
    : null;

  const before = purchase.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    const fields = { ...input, updatedBy: actingUserId };

    if (lines) {
      Object.assign(fields, sumPurchaseTotals(lines));
      await PurchaseItem.destroy({ where: { tenantId, purchaseId: purchase.id }, transaction });
      for (const line of lines) {
        await PurchaseItem.create({ tenantId, purchaseId: purchase.id, ...line }, { transaction });
      }
    }

    await purchase.update(fields, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'Purchase', entityId: purchase.id, performedBy: actingUserId, before, after: purchase },
      { transaction }
    );

    return purchase;
  });

  return getPurchase({ tenantId, auth, id: updated.id });
}

async function receivePurchase({ tenantId, auth, actingUserId, id, payload }) {
  const purchase = await repo.findByPk(tenantId, id);
  if (!purchase) throw AppError.notFound('Purchase not found');
  assertSiteAllowed(auth, purchase.siteId, 'Purchase not found');

  if (purchase.status !== 'draft') {
    throw AppError.conflict('This purchase has already been received');
  }

  const lines = await PurchaseItem.findAll({ where: { tenantId, purchaseId: purchase.id } });
  if (lines.length === 0) throw AppError.badRequest('This purchase has no items to receive');

  const overrides = new Map();
  if (Array.isArray(payload?.items)) {
    for (const override of payload.items) {
      const purchaseItemId = requireNumber(override?.purchaseItemId, 'Purchase item', { min: 1 });
      const receivedQuantity = requireNumber(override?.receivedQuantity, 'Received quantity', { min: 0 });
      overrides.set(purchaseItemId, receivedQuantity);
    }
  }

  const updated = await sequelize.transaction(async (transaction) => {
    for (const line of lines) {
      const receivedQuantity = overrides.has(line.id) ? overrides.get(line.id) : Number(line.purchasedQuantity);

      if (receivedQuantity > 0) {
        await postInventoryTransaction({
          tenantId,
          siteId: purchase.siteId,
          itemId: line.itemId,
          storageLocationId: line.storageLocationId,
          uomId: line.uomId,
          transactionType: 'PURCHASE_RECEIPT',
          direction: 'IN',
          quantity: receivedQuantity,
          unitCost: line.unitPriceInclTax,
          referenceType: 'PURCHASE_ITEM',
          referenceId: line.id,
          createdBy: actingUserId,
          transaction,
        });
      }

      await line.update(
        {
          receivedQuantity,
          lineStatus: receivedQuantity >= Number(line.purchasedQuantity) ? 'received' : 'pending',
        },
        { transaction }
      );
    }

    const before = purchase.toJSON();
    await purchase.update({ status: 'received', updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'Purchase', entityId: purchase.id, performedBy: actingUserId, before, after: purchase },
      { transaction }
    );

    return purchase;
  });

  return getPurchase({ tenantId, auth, id: updated.id });
}

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  receivePurchase,
};
