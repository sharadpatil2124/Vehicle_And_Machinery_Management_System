const { Op } = require('sequelize');

const { sequelize, Purchase, PurchaseItem, Item, Supplier, Site, UnitOfMeasure } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber, optionalNumber, requireDateOnly } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { nextSequentialCode } = require('./codeGenerator');
const { recordCreate, recordUpdate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { postInventoryTransaction } = require('./inventoryTransaction.service');
const { assertItemsCanTakeStock } = require('./masterData');

const repo = createTenantScopedRepository(Purchase);

const SORTABLE_FIELDS = ['createdAt', 'purchaseDate', 'purchaseNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const PURCHASE_NUMBER_PREFIX = 'PO-';
const PURCHASE_NUMBER_GENERATION_ATTEMPTS = 5;

function toPublic(purchase) {
  const json = purchase.toPublicJSON();
  if (purchase.supplier) json.supplierName = purchase.supplier.supplierName;
  if (purchase.site) json.siteName = purchase.site.name;
  if (purchase.items) {
    json.items = purchase.items.map((line) => {
      const lineJson = line.toPublicJSON();
      if (line.item) lineJson.itemName = line.item.itemName;
      if (line.uom) lineJson.uomName = line.uom.uomName;
      return lineJson;
    });
  }
  return json;
}

async function generatePurchaseNumber(tenantId, { transaction } = {}) {
  return nextSequentialCode(Purchase, 'purchaseNumber', PURCHASE_NUMBER_PREFIX, { tenantId, transaction });
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
  const purchasedQuantity = requireNumber(raw?.purchasedQuantity, `${label}: purchased quantity`, { min: 0.001 });
  const unitPrice = requireNumber(raw?.unitPrice, `${label}: unit price`, { min: 0 });
  const taxPercentage = optionalNumber(raw?.taxPercentage, `${label}: tax percentage`, { min: 0 }) ?? 0;

  return { itemId, purchasedQuantity, unitPrice, taxPercentage };
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

async function buildValidatedLines(tenantId, itemsInput) {
  const lines = [];
  for (const line of itemsInput) {
    const item = await assertItemUsable(tenantId, line.itemId);
    const { taxAmount, lineTotalAmount } = computeLineAmounts(line);
    lines.push({
      itemId: line.itemId,
      uomId: item.baseUomId,
      purchasedQuantity: line.purchasedQuantity,
      unitPrice: line.unitPrice,
      taxPercentage: line.taxPercentage,
      taxAmount,
      lineTotalAmount,
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
  if (search) where.purchaseNumber = { [Op.like]: containsPattern(search) };

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getPurchase({ tenantId, auth, id }) {
  // Names come with the document, so it still reads correctly after a record it used is archived.
  const purchase = await repo.findByPk(tenantId, id, {
    include: [
      { model: Supplier, as: 'supplier', attributes: ['supplierName'] },
      { model: Site, as: 'site', attributes: ['name'] },
      {
        model: PurchaseItem,
        as: 'items',
        include: [
          { model: Item, as: 'item', attributes: ['itemName'] },
          { model: UnitOfMeasure, as: 'uom', attributes: ['uomName'] },
        ],
      },
    ],
  });
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
  const lines = await buildValidatedLines(tenantId, itemsInput);
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
  const updated = await sequelize.transaction(async (transaction) => {
    // The row lock makes this take turns with a receive of the same purchase.
    const purchase = await repo.findByPk(tenantId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!purchase) throw AppError.notFound('Purchase not found');
    assertSiteAllowed(auth, purchase.siteId, 'Purchase not found');

    if (purchase.status !== 'draft') {
      throw AppError.conflict('This purchase has already been received and can no longer be edited');
    }

    const input = readPurchaseInput(payload, { partial: true });
    // Only a new supplier is checked: a draft may keep one that was archived after it was chosen.
    if (input.supplierId !== undefined && input.supplierId !== purchase.supplierId) {
      await assertSupplierUsable(tenantId, input.supplierId);
    }

    const hasNewItems = payload.items !== undefined;
    const lines = hasNewItems
      ? await buildValidatedLines(tenantId, readPurchaseItemsInput(payload.items))
      : null;

    const before = purchase.toJSON();
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
  const updated = await sequelize.transaction(async (transaction) => {
    // Checked under the row lock, so the same purchase received twice at once can only post once.
    // These reads stay locking: a plain read here would start the snapshot before stock postings take their turn.
    const purchase = await repo.findByPk(tenantId, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!purchase) throw AppError.notFound('Purchase not found');
    assertSiteAllowed(auth, purchase.siteId, 'Purchase not found');

    if (purchase.status !== 'draft') {
      throw AppError.conflict('This purchase has already been received');
    }

    const lines = await PurchaseItem.findAll({
      where: { tenantId, purchaseId: purchase.id },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (lines.length === 0) throw AppError.badRequest('This purchase has no items to receive');

    const overrides = new Map();
    if (Array.isArray(payload?.items)) {
      for (const override of payload.items) {
        const purchaseItemId = requireNumber(override?.purchaseItemId, 'Purchase item', { min: 1 });
        const receivedQuantity = requireNumber(override?.receivedQuantity, 'Received quantity', { min: 0 });
        overrides.set(purchaseItemId, receivedQuantity);
      }
    }

    const quantityToReceive = (line) => (overrides.has(line.id) ? overrides.get(line.id) : Number(line.purchasedQuantity));

    const receivingItemIds = lines.filter((line) => quantityToReceive(line) > 0).map((line) => line.itemId);
    await assertItemsCanTakeStock(tenantId, receivingItemIds, transaction);

    for (const line of lines) {
      const receivedQuantity = quantityToReceive(line);

      if (receivedQuantity > 0) {
        await postInventoryTransaction({
          tenantId,
          siteId: purchase.siteId,
          itemId: line.itemId,
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
