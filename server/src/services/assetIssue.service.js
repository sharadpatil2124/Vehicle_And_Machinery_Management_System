const { Op } = require('sequelize');

const {
  sequelize,
  AssetIssue,
  AssetIssueItem,
  IssueReversal,
  IssueReversalItem,
  Item,
  StorageLocation,
  StockBalance,
} = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordCreate } = require('./audit.service');
const { scopeToSite, assertSiteAllowed } = require('./siteAccess');
const { resolveAsset, ASSET_TYPES } = require('./asset.service');
const { postInventoryTransaction } = require('./inventoryTransaction.service');

const repo = createTenantScopedRepository(AssetIssue);

const SORTABLE_FIELDS = ['createdAt', 'issueDateTime', 'issueNumber'];
const DEFAULT_SORT = 'createdAt:desc';

const ISSUE_NUMBER_PREFIX = 'ISS-';
const ISSUE_NUMBER_GENERATION_ATTEMPTS = 5;

const INCLUDE_FULL = [
  { model: AssetIssueItem, as: 'items' },
  {
    model: IssueReversal,
    as: 'reversals',
    include: [{ model: IssueReversalItem, as: 'items' }],
  },
];

function toPublic(issue) {
  const json = issue.toPublicJSON();
  if (issue.items) json.items = issue.items.map((line) => line.toPublicJSON());
  if (issue.reversals) {
    json.reversals = issue.reversals.map((reversal) => ({
      ...reversal.toPublicJSON(),
      items: (reversal.items ?? []).map((line) => line.toPublicJSON()),
    }));
  }
  return json;
}

async function generateIssueNumber(tenantId, { transaction } = {}) {
  const highest = await AssetIssue.max('issueNumber', { where: { tenantId }, transaction });
  const nextNumber = highest ? Number(highest.slice(ISSUE_NUMBER_PREFIX.length)) + 1 : 1;
  return `${ISSUE_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isIssueNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_asset_issues_tenant_number')
  );
}

function meterTypeFor(assetType, asset) {
  if (assetType === ASSET_TYPES.MACHINERY) return 'HOURS';
  return asset.isHoursBased ? 'HOURS' : 'KM';
}

function readAssetIssueInput(payload) {
  const assetType = requireText(payload.assetType, 'Asset type', { max: 20 }).toUpperCase();
  if (!AssetIssue.ASSET_TYPES.includes(assetType)) {
    throw AppError.badRequest(`Asset type must be one of: ${AssetIssue.ASSET_TYPES.join(', ')}`);
  }
  const assetId = requireText(payload.assetId, 'Asset', { max: 64 });

  return {
    assetType,
    assetId,
    issueDateTime: payload.issueDateTime ? new Date(payload.issueDateTime) : new Date(),
    assetMeterReading: optionalNumber(payload.assetMeterReading, 'Meter reading', { min: 0 }),
    issuedToPerson: optionalText(payload.issuedToPerson, 'Issued to', { max: 150 }),
    purpose: optionalText(payload.purpose, 'Purpose', { max: 255 }),
    remarks: optionalText(payload.remarks, 'Remarks', { max: 2000 }),
  };
}

function readAssetIssueItemInput(raw, index) {
  const label = `Item ${index + 1}`;
  return {
    itemId: requireNumber(raw?.itemId, `${label}: item`, { min: 1 }),
    storageLocationId: requireNumber(raw?.storageLocationId, `${label}: storage location`, { min: 1 }),
    issuedQuantity: requireNumber(raw?.issuedQuantity, `${label}: issued quantity`, { min: 0.001 }),
  };
}

function readAssetIssueItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }
  return rawItems.map(readAssetIssueItemInput);
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
    throw AppError.badRequest("Storage location does not belong to this asset's site");
  }
  return location;
}

async function currentAverageCost(tenantId, siteId, itemId, storageLocationId) {
  const balance = await StockBalance.findOne({ where: { tenantId, siteId, itemId, storageLocationId } });
  return balance ? Number(balance.averageUnitCost) : 0;
}

async function listAssetIssues({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const where = scopeToSite({}, auth, 'siteId');
  const status = parseEnumFilter(query.status, AssetIssue.STATUSES, 'Status');
  if (status) where.status = status;
  const assetType = parseEnumFilter(query.assetType, AssetIssue.ASSET_TYPES, 'Asset type');
  if (assetType) where.assetType = assetType;
  if (query.assetId) where.assetId = query.assetId;

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) where.issueNumber = { [Op.like]: `%${search}%` };

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getAssetIssue({ tenantId, auth, id }) {
  const issue = await repo.findByPk(tenantId, id, { include: INCLUDE_FULL });
  if (!issue) throw AppError.notFound('Asset issue not found');
  assertSiteAllowed(auth, issue.siteId, 'Asset issue not found');
  return toPublic(issue);
}

async function createAssetIssue({ tenantId, auth, actingUserId, payload }) {
  const input = readAssetIssueInput(payload);
  const itemsInput = readAssetIssueItemsInput(payload.items);

  const asset = await resolveAsset(tenantId, input.assetType, input.assetId, { auth });
  const siteId = asset.currentSiteId;
  if (siteId == null) {
    throw AppError.badRequest('This asset has no site assigned yet, so stock cannot be issued to it');
  }
  const meterType = input.assetMeterReading != null ? meterTypeFor(input.assetType, asset) : null;

  const lines = [];
  for (const line of itemsInput) {
    const item = await assertItemUsable(tenantId, line.itemId);
    await assertStorageLocationUsable(tenantId, line.storageLocationId, siteId);
    const unitCost = await currentAverageCost(tenantId, siteId, line.itemId, line.storageLocationId);
    lines.push({
      itemId: line.itemId,
      storageLocationId: line.storageLocationId,
      uomId: item.baseUomId,
      issuedQuantity: line.issuedQuantity,
      unitCost,
      totalCost: Math.round(line.issuedQuantity * unitCost * 100) / 100,
    });
  }

  const issue = await sequelize.transaction(async (transaction) => {
    let created;
    for (let attempt = 1; attempt <= ISSUE_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const issueNumber = await generateIssueNumber(tenantId, { transaction });
      try {
        created = await repo.create(
          tenantId,
          {
            siteId,
            assetType: input.assetType,
            assetId: input.assetId,
            issueNumber,
            issueDateTime: input.issueDateTime,
            assetMeterReading: input.assetMeterReading,
            meterType,
            issuedToPerson: input.issuedToPerson,
            issuedByUserId: actingUserId,
            purpose: input.purpose,
            remarks: input.remarks,
            status: 'issued',
          },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === ISSUE_NUMBER_GENERATION_ATTEMPTS;
        if (!isIssueNumberCollision(error) || isLastAttempt) throw error;
      }
    }

    for (const line of lines) {
      const issueItem = await AssetIssueItem.create(
        { tenantId, assetIssueId: created.id, ...line },
        { transaction }
      );

      const posted = await postInventoryTransaction({
        tenantId,
        siteId,
        itemId: line.itemId,
        storageLocationId: line.storageLocationId,
        uomId: line.uomId,
        transactionType: 'ISSUE',
        direction: 'OUT',
        quantity: line.issuedQuantity,
        unitCost: line.unitCost,
        referenceType: 'ASSET_ISSUE_ITEM',
        referenceId: issueItem.id,
        transactionAt: input.issueDateTime,
        createdBy: actingUserId,
        transaction,
      });

      await issueItem.update({ inventoryTransactionId: posted.id }, { transaction });
    }

    await recordCreate(
      { tenantId, entityType: 'AssetIssue', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return getAssetIssue({ tenantId, auth, id: issue.id });
}

module.exports = {
  listAssetIssues,
  getAssetIssue,
  createAssetIssue,
};
