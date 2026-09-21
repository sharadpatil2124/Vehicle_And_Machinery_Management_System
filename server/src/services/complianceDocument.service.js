const { sequelize, ComplianceDocument } = require('../models');
const AppError = require('../utils/AppError');
const { resolveAsset } = require('./asset.service');
const { recordCreate, recordUpdate } = require('./audit.service');

const { DOC_TYPES, ROAD_TAX_TYPES } = ComplianceDocument;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toPublic(doc) {
  return doc.toPublicJSON();
}

function assertDocType(docType) {
  if (!DOC_TYPES.includes(docType)) {
    throw AppError.badRequest(`Document type must be one of: ${DOC_TYPES.join(', ')}`);
  }
}

function requireDateOnly(value, label) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

function readComplianceInput(docType, payload) {
  if (docType === 'ROAD_TAX') {
    const roadTaxType = payload.roadTaxType;
    if (!ROAD_TAX_TYPES.includes(roadTaxType)) {
      throw AppError.badRequest(`Road tax type must be one of: ${ROAD_TAX_TYPES.join(', ')}`);
    }
    const expiryDate =
      roadTaxType === 'OTHER' ? requireDateOnly(payload.expiryDate, 'Road tax expiry date') : null;
    return { roadTaxType, startDate: null, expiryDate };
  }

  if (docType === 'NATIONAL_PERMIT') {
    return {
      roadTaxType: null,
      startDate: null,
      expiryDate: requireDateOnly(payload.expiryDate, 'Expiry date'),
    };
  }

  const startDate = requireDateOnly(payload.startDate, 'Start date');
  const expiryDate = requireDateOnly(payload.expiryDate, 'End date');
  // The end date must be strictly after the start date — not before it, and
  // not the same day either. Dates are "YYYY-MM-DD" strings, so they compare
  // correctly with plain string operators; this is the backstop behind the
  // matching client-side check in ComplianceFields.jsx.
  if (expiryDate < startDate) {
    throw AppError.badRequest('End date cannot be before the start date');
  }
  if (expiryDate === startDate) {
    throw AppError.badRequest('End date cannot be the same as the start date');
  }
  return { roadTaxType: null, startDate, expiryDate };
}

const DOC_TYPE_PAYLOAD_KEYS = {
  ROAD_TAX: 'roadTax',
  NATIONAL_PERMIT: 'nationalPermit',
  INSURANCE: 'insurance',
  STATE_PERMIT: 'statePermit',
  PUC: 'puc',
};

function isDocEntered(docType, raw) {
  if (!raw) return false;
  if (docType === 'ROAD_TAX') return Boolean(raw.roadTaxType);
  if (docType === 'NATIONAL_PERMIT') return Boolean(raw.expiryDate);
  return Boolean(raw.startDate) || Boolean(raw.expiryDate);
}

async function saveComplianceDocuments({ tenantId, assetType, assetId, actingUserId, compliance, transaction }) {
  const bundle = compliance ?? {};

  for (const docType of DOC_TYPES) {
    const raw = bundle[DOC_TYPE_PAYLOAD_KEYS[docType]];
    if (!isDocEntered(docType, raw)) continue;

    const input = readComplianceInput(docType, raw);
    const existing = await ComplianceDocument.findOne({
      where: { tenantId, assetType, assetId, docType },
      transaction,
    });

    if (existing) {
      const before = existing.toJSON();
      await existing.update({ ...input, updatedBy: actingUserId }, { transaction });
      await recordUpdate(
        {
          tenantId,
          entityType: 'ComplianceDocument',
          entityId: existing.id,
          performedBy: actingUserId,
          before,
          after: existing,
        },
        { transaction }
      );
    } else {
      const created = await ComplianceDocument.create(
        { tenantId, assetType, assetId, docType, ...input, createdBy: actingUserId, updatedBy: actingUserId },
        { transaction }
      );
      await recordCreate(
        { tenantId, entityType: 'ComplianceDocument', entityId: created.id, performedBy: actingUserId, after: created },
        { transaction }
      );
    }
  }
}

async function listComplianceDocuments({ tenantId, auth, assetType, assetId }) {
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const docs = await ComplianceDocument.findAll({ where: { tenantId, assetType, assetId } });
  const byType = new Map(docs.map((doc) => [doc.docType, doc]));

  return DOC_TYPES.map((docType) => {
    const doc = byType.get(docType);
    return {
      docType,
      entered: Boolean(doc),
      document: doc ? toPublic(doc) : null,
    };
  });
}

async function upsertComplianceDocument({ tenantId, auth, assetType, assetId, docType, actingUserId, payload }) {
  assertDocType(docType);
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const input = readComplianceInput(docType, payload);
  const existing = await ComplianceDocument.findOne({ where: { tenantId, assetType, assetId, docType } });

  const saved = await sequelize.transaction(async (transaction) => {
    if (existing) {
      const before = existing.toJSON();
      await existing.update({ ...input, updatedBy: actingUserId }, { transaction });
      await recordUpdate(
        {
          tenantId,
          entityType: 'ComplianceDocument',
          entityId: existing.id,
          performedBy: actingUserId,
          before,
          after: existing,
        },
        { transaction }
      );
      return existing;
    }

    const created = await ComplianceDocument.create(
      { tenantId, assetType, assetId, docType, ...input, createdBy: actingUserId, updatedBy: actingUserId },
      { transaction }
    );
    await recordCreate(
      { tenantId, entityType: 'ComplianceDocument', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );
    return created;
  });

  return toPublic(saved);
}

module.exports = {
  listComplianceDocuments,
  upsertComplianceDocument,
  saveComplianceDocuments,
};
