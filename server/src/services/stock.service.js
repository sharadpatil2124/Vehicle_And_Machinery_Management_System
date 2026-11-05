const { Op } = require('sequelize');

const { StockBalance, InventoryTransaction, Item, AssetIssue, AssetIssueItem, IssueReversalItem } = require('../models');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { requireIdFilter } = require('../utils/validation');
const { buildListResponse } = require('../utils/listResponse');
const { scopeToSite, supervisorSiteId } = require('./siteAccess');
const { costSummaryForBalances, keyOf } = require('./stockBatch.service');
const { assetKey, loadAssetDetails } = require('./assetDetails.service');
const { assetRefsMatchingNumber } = require('./assetIdentifier.service');

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
  return json;
}

function toPublicTransaction(txn) {
  const json = txn.toPublicJSON();
  if (txn.item) {
    json.itemCode = txn.item.itemCode;
    json.itemName = txn.item.itemName;
  }
  return json;
}

async function listStockBalances({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: BALANCE_SORTABLE_FIELDS,
    defaultSort: BALANCE_DEFAULT_SORT,
  });

  const where = scopeToSite({ tenantId }, auth, 'siteId');
  if (query.siteId && supervisorSiteId(auth) === null) where.siteId = requireIdFilter(query.siteId, 'Site');
  if (query.itemId) where.itemId = requireIdFilter(query.itemId, 'Item');

  const { rows, count } = await StockBalance.findAndCountAll({
    where,
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
    include: [
      {
        model: Item,
        as: 'item',
        attributes: ['itemCode', 'itemName', 'minimumStockLevel', 'reorderLevel', 'maximumStockLevel'],
      },
    ],
  });

  const costs = await costSummaryForBalances(tenantId, rows);
  const data = rows.map((row) => {
    const cost = costs.get(keyOf(row)) ?? { batches: [], stockValue: 0, latestUnitCost: null, previousUnitCost: null };
    return { ...toPublicBalance(row), ...cost };
  });

  return buildListResponse(data, { page, limit, total: count });
}

// The asset issue behind each issue or reversal row, found from the row's reference.
async function issuesBehindTransactions(tenantId, rows) {
  const idsWhere = (referenceType) => rows.filter((r) => r.referenceType === referenceType).map((r) => r.referenceId);
  const issueItemIds = idsWhere('ASSET_ISSUE_ITEM');
  const reversalItemIds = idsWhere('ISSUE_REVERSAL_ITEM');

  const issueOfItem = { model: AssetIssue, as: 'assetIssue', attributes: ['id', 'assetType', 'assetId'] };
  const [issueItems, reversalItems] = await Promise.all([
    issueItemIds.length
      ? AssetIssueItem.findAll({ where: { tenantId, id: issueItemIds }, attributes: ['id'], include: [issueOfItem] })
      : [],
    reversalItemIds.length
      ? IssueReversalItem.findAll({
          where: { tenantId, id: reversalItemIds },
          attributes: ['id'],
          include: [{ model: AssetIssueItem, as: 'assetIssueItem', attributes: ['id'], include: [issueOfItem] }],
        })
      : [],
  ]);

  const issues = new Map();
  for (const line of issueItems) issues.set(`ASSET_ISSUE_ITEM:${line.id}`, line.assetIssue);
  for (const line of reversalItems) issues.set(`ISSUE_REVERSAL_ITEM:${line.id}`, line.assetIssueItem.assetIssue);
  return issues;
}

// The issue and reversal rows of the assets with this RCPL or Registration Number. Null when there are none.
async function transactionsOfAsset(tenantId, search) {
  const refs = await assetRefsMatchingNumber(tenantId, search);
  if (refs.length === 0) return null;

  const issueItems = await AssetIssueItem.findAll({
    where: { tenantId },
    attributes: ['id'],
    include: [{ model: AssetIssue, as: 'assetIssue', attributes: [], required: true, where: { tenantId, [Op.or]: refs } }],
  });
  if (issueItems.length === 0) return null;

  const issueItemIds = issueItems.map((line) => line.id);
  const reversalItems = await IssueReversalItem.findAll({
    where: { tenantId, assetIssueItemId: issueItemIds },
    attributes: ['id'],
  });

  return [
    { referenceType: 'ASSET_ISSUE_ITEM', referenceId: issueItemIds },
    { referenceType: 'ISSUE_REVERSAL_ITEM', referenceId: reversalItems.map((line) => line.id) },
  ];
}

async function listInventoryTransactions({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: TRANSACTION_SORTABLE_FIELDS,
    defaultSort: TRANSACTION_DEFAULT_SORT,
  });

  const where = scopeToSite({ tenantId }, auth, 'siteId');
  if (query.siteId && supervisorSiteId(auth) === null) where.siteId = requireIdFilter(query.siteId, 'Site');
  if (query.itemId) where.itemId = requireIdFilter(query.itemId, 'Item');
  const transactionType = parseEnumFilter(
    query.transactionType,
    InventoryTransaction.TYPES,
    'Transaction type'
  );
  if (transactionType) where.transactionType = transactionType;

  const assetSearch = typeof query.assetSearch === 'string' ? query.assetSearch.trim() : '';
  if (assetSearch) {
    const ofAsset = await transactionsOfAsset(tenantId, assetSearch);
    if (!ofAsset) return buildListResponse([], { page, limit, total: 0 });
    where[Op.or] = ofAsset;
  }

  const { rows, count } = await InventoryTransaction.findAndCountAll({
    where,
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
    include: [
      { model: Item, as: 'item', attributes: ['itemCode', 'itemName'] },
    ],
  });

  const issues = await issuesBehindTransactions(tenantId, rows);
  const assets = await loadAssetDetails(tenantId, [...issues.values()], auth);

  const data = rows.map((row) => {
    const json = toPublicTransaction(row);
    const issue = issues.get(`${row.referenceType}:${row.referenceId}`);
    if (issue) {
      json.assetIssueId = issue.id;
      json.asset = assets.get(assetKey(issue.assetType, issue.assetId)) ?? { assetType: issue.assetType, assetId: issue.assetId };
    }
    return json;
  });

  return buildListResponse(data, { page, limit, total: count });
}

module.exports = { listStockBalances, listInventoryTransactions };
