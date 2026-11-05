const { Op } = require('sequelize');

const { sequelize, TyrePurchase, TyrePurchaseItem, TyreType } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');
const { supervisorSiteId, assertSiteAllowed } = require('./siteAccess');
const { requireBusinessDate, optionalDateFilter, roundMoney, siteNamesById } = require('./fuelCommon');
const { siteFilter, assertSiteUsable, lockStock } = require('./tyreCommon');

const repo = createTenantScopedRepository(TyrePurchase);
const NUMBER_PREFIX = 'TP-';
const NUMBER_ATTEMPTS = 5;
const MAX_LINES = 50;
const MAX_QUANTITY = 10000;

function readItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('Add at least one tyre line');
  if (items.length > MAX_LINES) throw AppError.badRequest(`A purchase can have at most ${MAX_LINES} lines`);
  return items.map((raw, index) => {
    const label = `Line ${index + 1}`;
    const tyreTypeId = requireNumber(raw?.tyreTypeId, `${label}: tyre type`, { min: 1 });
    const quantity = requireNumber(raw?.quantity, `${label}: quantity`, { min: 1 });
    if (!Number.isInteger(quantity)) throw AppError.badRequest(`${label}: quantity must be a whole number`);
    if (quantity > MAX_QUANTITY) throw AppError.badRequest(`${label}: quantity can't be more than ${MAX_QUANTITY}`);
    const unitPrice = roundMoney(requireNumber(raw?.unitPrice, `${label}: price per tyre`, { min: 0 }));
    if (unitPrice <= 0) throw AppError.badRequest(`${label}: price per tyre must be more than 0`);
    const taxPercentage = roundMoney(optionalNumber(raw?.taxPercentage, `${label}: GST %`, { min: 0 }) ?? 0);
    if (taxPercentage > 100) throw AppError.badRequest(`${label}: GST % can't be more than 100`);
    const unitCost = roundMoney(unitPrice * (1 + taxPercentage / 100));
    return { tyreTypeId, quantity, unitPrice, taxPercentage, unitCost, lineTotal: roundMoney(unitCost * quantity) };
  });
}

async function decorate(tenantId, purchases, { withItems = false } = {}) {
  if (purchases.length === 0) return [];
  const siteNames = await siteNamesById(tenantId, purchases.map((p) => p.siteId));

  let itemsByPurchase = new Map();
  if (withItems) {
    const items = await TyrePurchaseItem.findAll({
      where: { tenantId, purchaseId: purchases.map((p) => p.id) },
      include: [{ model: TyreType, as: 'tyreType' }],
      order: [['id', 'ASC']],
    });
    itemsByPurchase = items.reduce((map, item) => {
      const list = map.get(item.purchaseId) ?? [];
      list.push({ ...item.toPublicJSON(), tyreTypeLabel: item.tyreType?.label ?? null, tyreSize: item.tyreType?.size ?? null, tyreTypeCode: item.tyreType?.typeCode ?? null });
      map.set(item.purchaseId, list);
      return map;
    }, new Map());
  }

  return purchases.map((p) => ({
    ...p.toPublicJSON(),
    siteName: siteNames.get(p.siteId) ?? null,
    ...(withItems ? { items: itemsByPurchase.get(p.id) ?? [] } : {}),
  }));
}

async function listTyrePurchases({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, { sortableFields: ['purchaseDate', 'purchaseNumber', 'totalAmount', 'createdAt'], defaultSort: 'purchaseDate:desc' });
  const where = {};
  const siteId = siteFilter(auth, query);
  if (siteId) where.siteId = siteId;
  const status = parseEnumFilter(query.status, TyrePurchase.STATUSES, 'Status');
  if (status) where.status = status;
  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    where.purchaseDate = {};
    if (dateFrom) where.purchaseDate[Op.gte] = dateFrom;
    if (dateTo) where.purchaseDate[Op.lte] = dateTo;
  }
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: containsPattern(search) };
    where[Op.or] = [{ purchaseNumber: like }, { billNumber: like }, { supplierName: like }];
  }
  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order: [...order, ['id', 'DESC']], limit, offset });
  return buildListResponse(await decorate(tenantId, rows), { page, limit, total: count });
}

async function findVisible(tenantId, auth, id, options = {}) {
  const purchase = await repo.findByPk(tenantId, id, options);
  if (!purchase) throw AppError.notFound('Tyre purchase not found');
  assertSiteAllowed(auth, purchase.siteId, 'Tyre purchase not found');
  return purchase;
}

async function getTyrePurchase({ tenantId, auth, id }) {
  const purchase = await findVisible(tenantId, auth, id);
  const [json] = await decorate(tenantId, [purchase], { withItems: true });
  return json;
}

async function createTyrePurchase({ tenantId, auth, actingUserId, payload }) {
  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId ?? (await assertSiteUsable(tenantId, payload.siteId));
  const supplierName = optionalText(payload.supplierName, 'Supplier', { max: 255 });
  const purchaseDate = requireBusinessDate(payload.purchaseDate, 'Purchase date');
  const billNumber = optionalText(payload.billNumber, 'Bill / invoice number', { max: 64 });
  const notes = optionalText(payload.notes, 'Notes', { max: 1000 });
  const lines = readItems(payload.items);

  const typeIds = [...new Set(lines.map((l) => l.tyreTypeId))];
  const types = await TyreType.findAll({ where: { tenantId, id: typeIds } });
  if (types.length !== typeIds.length) throw AppError.badRequest('One of the tyre types was not found');
  if (types.some((t) => t.status !== 'active')) throw AppError.badRequest('One of the tyre types is archived');

  const subtotalAmount = roundMoney(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const totalAmount = roundMoney(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const totals = {
    tyreCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotalAmount,
    taxAmount: roundMoney(totalAmount - subtotalAmount),
    totalAmount,
  };

  const created = await sequelize.transaction(async (transaction) => {
    let purchase;
    for (let attempt = 1; attempt <= NUMBER_ATTEMPTS; attempt += 1) {
      const purchaseNumber = await nextSequentialCode(TyrePurchase, 'purchaseNumber', NUMBER_PREFIX, { tenantId, transaction });
      try {
        purchase = await repo.create(
          tenantId,
          { siteId, supplierName, purchaseDate, billNumber, notes, ...totals, purchaseNumber, status: 'active', createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        if (!isCodeCollision(error, 'uq_tyre_purchases_tenant_number') || attempt === NUMBER_ATTEMPTS) throw error;
      }
    }

    for (const line of lines) {
      await TyrePurchaseItem.create({ tenantId, purchaseId: purchase.id, ...line }, { transaction });
      const stock = await lockStock(tenantId, siteId, line.tyreTypeId, transaction);
      await stock.update(
        { newQuantity: Number(stock.newQuantity) + line.quantity, stockValue: roundMoney(Number(stock.stockValue) + line.lineTotal) },
        { transaction }
      );
    }

    await recordCreate({ tenantId, entityType: 'TyrePurchase', entityId: purchase.id, performedBy: actingUserId, after: purchase }, { transaction });
    return purchase;
  });

  return getTyrePurchase({ tenantId, auth, id: created.id });
}

async function cancelTyrePurchase({ tenantId, auth, actingUserId, id, confirmation }) {
  if (confirmation !== 'DELETE') throw AppError.badRequest('Type DELETE to confirm this action.');

  await sequelize.transaction(async (transaction) => {
    const purchase = await findVisible(tenantId, auth, id, { transaction, lock: transaction.LOCK.UPDATE });
    if (purchase.status === 'cancelled') throw AppError.conflict('This purchase is already cancelled');

    const items = await TyrePurchaseItem.findAll({ where: { tenantId, purchaseId: purchase.id }, transaction });
    const byType = new Map();
    for (const item of items) {
      const entry = byType.get(item.tyreTypeId) ?? { quantity: 0, value: 0 };
      entry.quantity += item.quantity;
      entry.value = roundMoney(entry.value + Number(item.lineTotal));
      byType.set(item.tyreTypeId, entry);
    }

    for (const [tyreTypeId, entry] of byType) {
      const stock = await lockStock(tenantId, purchase.siteId, tyreTypeId, transaction);
      if (Number(stock.newQuantity) < entry.quantity) {
        throw AppError.conflict(
          "Some tyres from this purchase have already been fitted, so it can't be cancelled."
        );
      }
      const newQuantity = Number(stock.newQuantity) - entry.quantity;
      const stockValue = newQuantity === 0 ? 0 : Math.max(0, roundMoney(Number(stock.stockValue) - entry.value));
      await stock.update({ newQuantity, stockValue }, { transaction });
    }

    const before = purchase.toJSON();
    await purchase.update({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: actingUserId, updatedBy: actingUserId }, { transaction });
    await recordUpdate({ tenantId, entityType: 'TyrePurchase', entityId: purchase.id, performedBy: actingUserId, before, after: purchase }, { transaction });
  });

  return getTyrePurchase({ tenantId, auth, id });
}

module.exports = { listTyrePurchases, getTyrePurchase, createTyrePurchase, cancelTyrePurchase };
