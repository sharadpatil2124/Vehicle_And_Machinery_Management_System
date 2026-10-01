const { Op } = require('sequelize');

const { sequelize, StockTransfer, StockTransferItem, Item, StorageLocation, StockBalance, Site } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate, recordUpdate } = require('./audit.service');
const { assertSiteAllowed, assertEitherSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { postInventoryTransaction } = require('./inventoryTransaction.service');

const repo = createTenantScopedRepository(StockTransfer);

const SORTABLE_FIELDS = ['createdAt', 'transferDate', 'transferNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const TRANSFER_NUMBER_PREFIX = 'TRF-';
const TRANSFER_NUMBER_GENERATION_ATTEMPTS = 5;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireDateOnly(value, label) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

function toPublic(transfer) {
  const json = transfer.toPublicJSON();
  if (transfer.fromSite) json.fromSiteName = transfer.fromSite.name;
  if (transfer.toSite) json.toSiteName = transfer.toSite.name;
  if (transfer.items) {
    json.items = transfer.items.map((line) => {
      const itemJson = line.toPublicJSON();
      if (line.item) itemJson.itemName = line.item.itemName;
      if (line.fromStorageLocation) itemJson.fromLocationName = line.fromStorageLocation.locationName;
      if (line.toStorageLocation) itemJson.toLocationName = line.toStorageLocation.locationName;
      return itemJson;
    });
  }
  return json;
}

async function generateTransferNumber(tenantId, { transaction } = {}) {
  const highest = await StockTransfer.max('transferNumber', { where: { tenantId }, transaction });
  const nextNumber = highest ? Number(highest.slice(TRANSFER_NUMBER_PREFIX.length)) + 1 : 1;
  return `${TRANSFER_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isTransferNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_stock_transfers_tenant_number')
  );
}

function readTransferInput(payload) {
  return {
    toSiteId: requireNumber(payload.toSiteId, 'Destination site', { min: 1 }),
    transferDate: requireDateOnly(payload.transferDate, 'Transfer date'),
    remarks: optionalText(payload.remarks, 'Remarks', { max: 2000 }),
  };
}

function readTransferItemInput(raw, index) {
  const label = `Item ${index + 1}`;
  return {
    itemId: requireNumber(raw?.itemId, `${label}: item`, { min: 1 }),
    fromStorageLocationId: requireNumber(raw?.fromStorageLocationId, `${label}: source storage location`, { min: 1 }),
    toStorageLocationId: requireNumber(raw?.toStorageLocationId, `${label}: destination storage location`, { min: 1 }),
    quantity: requireNumber(raw?.quantity, `${label}: quantity`, { min: 0.001 }),
  };
}

function readTransferItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }
  return rawItems.map(readTransferItemInput);
}

async function assertItemUsable(tenantId, itemId) {
  const item = await Item.findOne({ where: { tenantId, id: itemId } });
  if (!item) throw AppError.badRequest('Item not found');
  if (item.status !== 'active') throw AppError.badRequest('Item is archived and cannot be used');
  return item;
}

async function assertStorageLocationUsable(tenantId, storageLocationId, siteId, label) {
  const location = await StorageLocation.findOne({ where: { tenantId, id: storageLocationId } });
  if (!location) throw AppError.badRequest(`${label} storage location not found`);
  if (location.status !== 'active') throw AppError.badRequest(`${label} storage location is archived and cannot be used`);
  if (Number(location.siteId) !== Number(siteId)) {
    throw AppError.badRequest(`${label} storage location does not belong to the ${label.toLowerCase()} site`);
  }
  return location;
}

async function listStockTransfers({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const where = {};
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) {
    where[Op.or] = [{ fromSiteId: ownSiteId }, { toSiteId: ownSiteId }];
  }

  const status = query.status === 'in_transit' || query.status === 'completed' ? query.status : undefined;
  if (status) where.status = status;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.transferNumber = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, {
    where,
    order,
    limit,
    offset,
    include: [
      { model: Site, as: 'fromSite', attributes: ['name'] },
      { model: Site, as: 'toSite', attributes: ['name'] },
    ],
  });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getStockTransfer({ tenantId, auth, id }) {
  const transfer = await repo.findByPk(tenantId, id, {
    include: [
      { model: Site, as: 'fromSite', attributes: ['name'] },
      { model: Site, as: 'toSite', attributes: ['name'] },
      {
        model: StockTransferItem,
        as: 'items',
        include: [
          { model: Item, as: 'item', attributes: ['itemName'] },
          { model: StorageLocation, as: 'fromStorageLocation', attributes: ['locationName'] },
          { model: StorageLocation, as: 'toStorageLocation', attributes: ['locationName'] },
        ],
      },
    ],
  });
  if (!transfer) throw AppError.notFound('Stock transfer not found');
  assertEitherSiteAllowed(auth, transfer.fromSiteId, transfer.toSiteId, 'Stock transfer not found');
  return toPublic(transfer);
}

async function createStockTransfer({ tenantId, auth, actingUserId, payload }) {
  const ownSiteId = supervisorSiteId(auth);
  const fromSiteId = ownSiteId !== null ? ownSiteId : optionalNumber(payload.fromSiteId, 'Source site', { min: 1 });
  if (fromSiteId == null) throw AppError.badRequest('Source site is required');

  const input = readTransferInput(payload);
  if (Number(input.toSiteId) === Number(fromSiteId)) {
    throw AppError.badRequest('Source and destination site must be different');
  }
  await assertSiteAssignable(tenantId, fromSiteId);
  await assertSiteAssignable(tenantId, input.toSiteId);

  const itemsInput = readTransferItemsInput(payload.items);

  const lines = [];
  for (const line of itemsInput) {
    const item = await assertItemUsable(tenantId, line.itemId);
    await assertStorageLocationUsable(tenantId, line.fromStorageLocationId, fromSiteId, 'Source');
    await assertStorageLocationUsable(tenantId, line.toStorageLocationId, input.toSiteId, 'Destination');

    const balance = await StockBalance.findOne({
      where: { tenantId, siteId: fromSiteId, itemId: line.itemId, storageLocationId: line.fromStorageLocationId },
    });
    const unitCost = balance ? Number(balance.averageUnitCost) : 0;

    lines.push({
      itemId: line.itemId,
      fromStorageLocationId: line.fromStorageLocationId,
      toStorageLocationId: line.toStorageLocationId,
      uomId: item.baseUomId,
      quantity: line.quantity,
      unitCost,
      totalCost: Math.round(line.quantity * unitCost * 100) / 100,
    });
  }

  const transfer = await sequelize.transaction(async (transaction) => {
    let created;
    for (let attempt = 1; attempt <= TRANSFER_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const transferNumber = await generateTransferNumber(tenantId, { transaction });
      try {
        created = await repo.create(
          tenantId,
          {
            fromSiteId,
            toSiteId: input.toSiteId,
            transferDate: input.transferDate,
            remarks: input.remarks,
            dispatchedBy: actingUserId,
            transferNumber,
            status: 'in_transit',
          },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === TRANSFER_NUMBER_GENERATION_ATTEMPTS;
        if (!isTransferNumberCollision(error) || isLastAttempt) throw error;
      }
    }

    for (const line of lines) {
      await StockTransferItem.create({ tenantId, stockTransferId: created.id, ...line }, { transaction });
    }

    await recordCreate(
      { tenantId, entityType: 'StockTransfer', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return getStockTransfer({ tenantId, auth, id: transfer.id });
}

async function receiveStockTransfer({ tenantId, auth, actingUserId, id }) {
  const transfer = await repo.findByPk(tenantId, id, { include: [{ model: StockTransferItem, as: 'items' }] });
  if (!transfer) throw AppError.notFound('Stock transfer not found');
  assertSiteAllowed(auth, transfer.toSiteId, 'Stock transfer not found');

  if (transfer.status !== 'in_transit') {
    throw AppError.conflict('This transfer has already been received');
  }

  const updated = await sequelize.transaction(async (transaction) => {
    for (const line of transfer.items) {
      const postedOut = await postInventoryTransaction({
        tenantId,
        siteId: transfer.fromSiteId,
        itemId: line.itemId,
        storageLocationId: line.fromStorageLocationId,
        uomId: line.uomId,
        transactionType: 'TRANSFER_OUT',
        direction: 'OUT',
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        referenceType: 'STOCK_TRANSFER_ITEM',
        referenceId: line.id,
        createdBy: actingUserId,
        transaction,
      });

      const postedIn = await postInventoryTransaction({
        tenantId,
        siteId: transfer.toSiteId,
        itemId: line.itemId,
        storageLocationId: line.toStorageLocationId,
        uomId: line.uomId,
        transactionType: 'TRANSFER_IN',
        direction: 'IN',
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        referenceType: 'STOCK_TRANSFER_ITEM',
        referenceId: line.id,
        createdBy: actingUserId,
        transaction,
      });

      await line.update(
        { transferOutTransactionId: postedOut.id, transferInTransactionId: postedIn.id },
        { transaction }
      );
    }

    const before = transfer.toJSON();
    await transfer.update(
      { status: 'completed', receivedBy: actingUserId, receivedAt: new Date() },
      { transaction }
    );

    await recordUpdate(
      { tenantId, entityType: 'StockTransfer', entityId: transfer.id, performedBy: actingUserId, before, after: transfer },
      { transaction }
    );

    return transfer;
  });

  return getStockTransfer({ tenantId, auth, id: updated.id });
}

module.exports = {
  listStockTransfers,
  getStockTransfer,
  createStockTransfer,
  receiveStockTransfer,
};
