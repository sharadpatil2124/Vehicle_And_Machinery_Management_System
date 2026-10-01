const { StockBalance, InventoryTransaction, Item, StorageLocation } = require('../models');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { scopeToSite, supervisorSiteId } = require('./siteAccess');

const BALANCE_SORTABLE_FIELDS = ['updatedAt', 'quantityOnHand'];
const BALANCE_DEFAULT_SORT = 'updatedAt:desc';

const TRANSACTION_SORTABLE_FIELDS = ['transactionAt', 'createdAt'];
const TRANSACTION_DEFAULT_SORT = 'transactionAt:desc';

function toPublicBalance(balance) {
  const json = balance.toPublicJSON();
  if (balance.item) {
    json.itemCode = balance.item.itemCode;
    json.itemName = balance.item.itemName;
    json.minimumStockLevel = balance.item.minimumStockLevel == null ? null : Number(balance.item.minimumStockLevel);
    json.reorderLevel = balance.item.reorderLevel == null ? null : Number(balance.item.reorderLevel);
    json.maximumStockLevel = balance.item.maximumStockLevel == null ? null : Number(balance.item.maximumStockLevel);
  }
  if (balance.storageLocation) {
    json.locationCode = balance.storageLocation.locationCode;
    json.locationName = balance.storageLocation.locationName;
  }
  return json;
}

function toPublicTransaction(txn) {
  const json = txn.toPublicJSON();
  if (txn.item) {
    json.itemCode = txn.item.itemCode;
    json.itemName = txn.item.itemName;
  }
  if (txn.storageLocation) {
    json.locationCode = txn.storageLocation.locationCode;
    json.locationName = txn.storageLocation.locationName;
  }
  return json;
}

async function listStockBalances({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: BALANCE_SORTABLE_FIELDS,
    defaultSort: BALANCE_DEFAULT_SORT,
  });

  const where = scopeToSite({ tenantId }, auth, 'siteId');
  if (query.siteId && supervisorSiteId(auth) === null) where.siteId = Number(query.siteId);
  if (query.itemId) where.itemId = Number(query.itemId);
  if (query.storageLocationId) where.storageLocationId = Number(query.storageLocationId);

  const { rows, count } = await StockBalance.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      {
        model: Item,
        as: 'item',
        attributes: ['itemCode', 'itemName', 'minimumStockLevel', 'reorderLevel', 'maximumStockLevel'],
      },
      { model: StorageLocation, as: 'storageLocation', attributes: ['locationCode', 'locationName'] },
    ],
  });

  return buildListResponse(rows.map(toPublicBalance), { page, limit, total: count });
}

async function listInventoryTransactions({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: TRANSACTION_SORTABLE_FIELDS,
    defaultSort: TRANSACTION_DEFAULT_SORT,
  });

  const where = scopeToSite({ tenantId }, auth, 'siteId');
  if (query.itemId) where.itemId = Number(query.itemId);
  if (query.storageLocationId) where.storageLocationId = Number(query.storageLocationId);
  const transactionType = parseEnumFilter(
    query.transactionType,
    InventoryTransaction.TYPES,
    'Transaction type'
  );
  if (transactionType) where.transactionType = transactionType;

  const { rows, count } = await InventoryTransaction.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      { model: Item, as: 'item', attributes: ['itemCode', 'itemName'] },
      { model: StorageLocation, as: 'storageLocation', attributes: ['locationCode', 'locationName'] },
    ],
  });

  return buildListResponse(rows.map(toPublicTransaction), { page, limit, total: count });
}

module.exports = { listStockBalances, listInventoryTransactions };
