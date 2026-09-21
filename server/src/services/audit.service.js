const { AuditLog } = require('../models');

function recordAudit(
  { tenantId, entityType, entityId, action, before = null, after = null, performedBy = null },
  { transaction } = {}
) {
  return AuditLog.create(
    {
      tenantId,
      entityType,
      entityId: String(entityId),
      action,
      before,
      after,
      performedBy,
    },
    { transaction }
  );
}

const NEVER_AUDITED_FIELDS = ['passwordHash', 'tokenHash'];

function snapshot(instance) {
  if (!instance) return null;
  const plain = typeof instance.toJSON === 'function' ? instance.toJSON() : instance;
  const clean = { ...plain };
  for (const field of NEVER_AUDITED_FIELDS) delete clean[field];
  return clean;
}

function diffSnapshots(before, after) {
  const changedBefore = {};
  const changedAfter = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changedBefore[key] = beforeValue;
      changedAfter[key] = afterValue;
    }
  }

  return { before: changedBefore, after: changedAfter };
}

function recordCreate({ tenantId, entityType, entityId, performedBy, after }, { transaction } = {}) {
  return recordAudit(
    { tenantId, entityType, entityId, action: 'CREATED', after: snapshot(after), performedBy },
    { transaction }
  );
}

function recordUpdate(
  { tenantId, entityType, entityId, performedBy, before, after },
  { transaction } = {}
) {
  const diff = diffSnapshots(snapshot(before), snapshot(after));
  if (Object.keys(diff.after).length === 0) return null;

  return recordAudit(
    {
      tenantId,
      entityType,
      entityId,
      action: 'UPDATED',
      before: diff.before,
      after: diff.after,
      performedBy,
    },
    { transaction }
  );
}

function recordArchive({ tenantId, entityType, entityId, performedBy }, { transaction } = {}) {
  return recordAudit(
    {
      tenantId,
      entityType,
      entityId,
      action: 'ARCHIVED',
      before: { status: 'active' },
      after: { status: 'archived' },
      performedBy,
    },
    { transaction }
  );
}

function recordRestore({ tenantId, entityType, entityId, performedBy }, { transaction } = {}) {
  return recordAudit(
    {
      tenantId,
      entityType,
      entityId,
      action: 'RESTORED',
      before: { status: 'archived' },
      after: { status: 'active' },
      performedBy,
    },
    { transaction }
  );
}

module.exports = {
  recordAudit,
  snapshot,
  diffSnapshots,
  recordCreate,
  recordUpdate,
  recordArchive,
  recordRestore,
};
