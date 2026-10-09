const { sequelize, AssetIssue, AssetIssueItem, IssueReversal, IssueReversalItem } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText, requireNumber } = require('../utils/validation');
const { recordCreate } = require('./audit.service');
const { assertSiteAllowed } = require('./siteAccess');
const { postInventoryTransaction } = require('./inventoryTransaction.service');

const REVERSAL_NUMBER_PREFIX = 'REV-';
const REVERSAL_NUMBER_GENERATION_ATTEMPTS = 5;

function toPublic(reversal) {
  const json = reversal.toPublicJSON();
  if (reversal.items) json.items = reversal.items.map((line) => line.toPublicJSON());
  return json;
}

async function generateReversalNumber(tenantId, { transaction } = {}) {
  const highest = await IssueReversal.max('reversalNumber', { where: { tenantId }, transaction });
  const nextNumber = highest ? Number(highest.slice(REVERSAL_NUMBER_PREFIX.length)) + 1 : 1;
  return `${REVERSAL_NUMBER_PREFIX}${String(nextNumber).padStart(6, '0')}`;
}

function isReversalNumberCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).includes('uq_issue_reversals_tenant_number')
  );
}

function readReversalInput(payload) {
  return {
    reason: optionalText(payload.reason, 'Reason', { max: 2000 }),
  };
}

function readReversalItemInput(raw, index) {
  const label = `Item ${index + 1}`;
  return {
    assetIssueItemId: requireNumber(raw?.assetIssueItemId, `${label}: issued line`, { min: 1 }),
    reversedQuantity: requireNumber(raw?.reversedQuantity, `${label}: reversed quantity`, { min: 0.001 }),
  };
}

function readReversalItemsInput(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }
  return rawItems.map(readReversalItemInput);
}

async function createIssueReversal({ tenantId, auth, actingUserId, assetIssueId, payload }) {
  const issue = await AssetIssue.findOne({
    where: { tenantId, id: requireNumber(assetIssueId, 'Asset issue', { min: 1 }) },
  });
  if (!issue) throw AppError.notFound('Asset issue not found');
  assertSiteAllowed(auth, issue.siteId, 'Asset issue not found');

  const input = readReversalInput(payload);
  const itemsInput = readReversalItemsInput(payload.items);

  const lines = [];
  for (const line of itemsInput) {
    const issueItem = await AssetIssueItem.findOne({
      where: { tenantId, id: line.assetIssueItemId, assetIssueId: issue.id },
    });
    if (!issueItem) throw AppError.badRequest('That item was not part of this issue');

    const alreadyReversed = Number(issueItem.reversedQuantity);
    const remaining = Number(issueItem.issuedQuantity) - alreadyReversed;
    if (line.reversedQuantity > remaining) {
      throw AppError.badRequest(
        `Cannot reverse ${line.reversedQuantity} — only ${remaining} of this line is left to reverse`
      );
    }

    lines.push({ issueItem, reversedQuantity: line.reversedQuantity });
  }

  const reversal = await sequelize.transaction(async (transaction) => {
    let created;
    for (let attempt = 1; attempt <= REVERSAL_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const reversalNumber = await generateReversalNumber(tenantId, { transaction });
      try {
        created = await IssueReversal.create(
          {
            tenantId,
            assetIssueId: issue.id,
            reversalNumber,
            reversalDateTime: new Date(),
            ...input,
            reversedBy: actingUserId,
          },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === REVERSAL_NUMBER_GENERATION_ATTEMPTS;
        if (!isReversalNumberCollision(error) || isLastAttempt) throw error;
      }
    }

    for (const { issueItem, reversedQuantity } of lines) {
      const reversalItem = await IssueReversalItem.create(
        { tenantId, issueReversalId: created.id, assetIssueItemId: issueItem.id, reversedQuantity },
        { transaction }
      );

      const posted = await postInventoryTransaction({
        tenantId,
        siteId: issue.siteId,
        itemId: issueItem.itemId,
        storageLocationId: issueItem.storageLocationId,
        uomId: issueItem.uomId,
        transactionType: 'ISSUE_REVERSAL',
        direction: 'IN',
        quantity: reversedQuantity,
        unitCost: Number(issueItem.unitCost),
        reversesTransactionId: issueItem.inventoryTransactionId,
        referenceType: 'ISSUE_REVERSAL_ITEM',
        referenceId: reversalItem.id,
        createdBy: actingUserId,
        transaction,
      });

      await reversalItem.update({ inventoryTransactionId: posted.id }, { transaction });
      await issueItem.update(
        { reversedQuantity: Number(issueItem.reversedQuantity) + reversedQuantity },
        { transaction }
      );
    }

    const allItems = await AssetIssueItem.findAll({ where: { tenantId, assetIssueId: issue.id }, transaction });
    const fullyReversed = allItems.every((i) => Number(i.reversedQuantity) >= Number(i.issuedQuantity));
    const anyReversed = allItems.some((i) => Number(i.reversedQuantity) > 0);
    await issue.update(
      { status: fullyReversed ? 'fully_reversed' : anyReversed ? 'partially_reversed' : 'issued' },
      { transaction }
    );

    await recordCreate(
      { tenantId, entityType: 'IssueReversal', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return getIssueReversal({ tenantId, auth, id: reversal.id });
}

async function getIssueReversal({ tenantId, auth, id }) {
  const reversal = await IssueReversal.findOne({
    where: { tenantId, id },
    include: [{ model: IssueReversalItem, as: 'items' }, { model: AssetIssue, as: 'assetIssue' }],
  });
  if (!reversal) throw AppError.notFound('Issue reversal not found');
  assertSiteAllowed(auth, reversal.assetIssue.siteId, 'Issue reversal not found');
  return toPublic(reversal);
}

module.exports = { createIssueReversal, getIssueReversal };
