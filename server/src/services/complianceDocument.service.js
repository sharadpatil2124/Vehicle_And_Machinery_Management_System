const { QueryTypes } = require('sequelize');

const { sequelize, ComplianceDocument, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText } = require('../utils/validation');
const { parseListQuery, parseEnumFilter, containsPattern } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { resolveAsset, ASSET_TYPES } = require('./asset.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { supervisorSiteId } = require('./siteAccess');
const { toDateOnly } = require('./fuelCommon');

const { DOC_TYPES, ROAD_TAX_TYPES, EXPIRY_WARNING_DAYS } = ComplianceDocument;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const EXPIRY_FILTERS = Object.freeze({
  ATTENTION: 'cd.expiry_date <= :warnUntil',
  EXPIRED: 'cd.expiry_date < :today',
  EXPIRING_SOON: 'cd.expiry_date >= :today AND cd.expiry_date <= :warnUntil',
  VALID: 'cd.expiry_date > :warnUntil',
  NO_EXPIRY: 'cd.expiry_date IS NULL',
});

const SORT_COLUMNS = Object.freeze({
  expiryDate: 'cd.expiry_date',
  assetId: 'cd.asset_id',
  docType: 'cd.doc_type',
  updatedAt: 'cd.updated_at',
});
const DEFAULT_SORT = 'expiryDate:asc';

const ASSET_JOINS = `
  FROM compliance_documents cd
  LEFT JOIN vehicles v
         ON cd.asset_type = 'VEHICLE' AND v.tenant_id = cd.tenant_id AND v.asset_id = cd.asset_id
  LEFT JOIN machinery m
         ON cd.asset_type = 'MACHINERY' AND m.tenant_id = cd.tenant_id AND m.asset_id = cd.asset_id`;

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
  return {
    ...readComplianceDates(docType, payload),
    documentNumber: optionalText(payload.documentNumber, 'Document number', { max: 64 }),
  };
}

function readComplianceDates(docType, payload) {
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
  FITNESS: 'fitness',
};

function isDocEntered(docType, raw) {
  if (!raw) return false;
  if (raw.documentNumber) return true;
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

function select(sql, replacements) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

function num(value) {
  return value == null ? 0 : Number(value);
}

function buildScope({ tenantId, auth, query }) {
  const today = new Date();
  const warnUntil = new Date(today);
  warnUntil.setDate(warnUntil.getDate() + EXPIRY_WARNING_DAYS);

  const conditions = ['cd.tenant_id = :tenantId', "COALESCE(v.status, m.status) = 'active'"];
  const replacements = { tenantId, today: toDateOnly(today), warnUntil: toDateOnly(warnUntil) };

  let siteId = supervisorSiteId(auth);
  if (siteId === null && query.siteId) {
    siteId = Number(query.siteId);
    if (!Number.isInteger(siteId) || siteId < 1) throw AppError.badRequest('Site must be a valid site');
  }
  if (siteId !== null) {
    conditions.push('COALESCE(v.current_site_id, m.current_site_id) = :siteId');
    replacements.siteId = siteId;
  }

  const docType = parseEnumFilter(query.docType, DOC_TYPES, 'Document type');
  if (docType) {
    conditions.push('cd.doc_type = :docType');
    replacements.docType = docType;
  }

  const assetType = parseEnumFilter(query.assetType, ComplianceDocument.ASSET_TYPES, 'Asset type');
  if (assetType) {
    conditions.push('cd.asset_type = :assetType');
    replacements.assetType = assetType;
  }

  if (query.assetId) {
    conditions.push('cd.asset_id = :assetId');
    replacements.assetId = String(query.assetId);
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    conditions.push(
      `(cd.asset_id LIKE :search OR cd.document_number LIKE :search
        OR v.registration_number LIKE :search OR m.rcpl LIKE :search OR m.name LIKE :search)`
    );
    replacements.search = containsPattern(search);
  }

  return { conditions, replacements };
}

function whereSql(conditions) {
  return `WHERE ${conditions.join(' AND ')}`;
}

async function findDocuments(tenantId, conditions, replacements, { orderSql, limit, offset }) {
  const paging = limit === undefined ? '' : ' LIMIT :limit OFFSET :offset';
  const rows = await select(
    `SELECT cd.id,
            COALESCE(v.id, m.id) AS assetRecordId,
            COALESCE(v.current_site_id, m.current_site_id) AS siteId,
            v.registration_number AS registrationNumber,
            m.rcpl, m.name AS machineName
       ${ASSET_JOINS}
       ${whereSql(conditions)}
      ORDER BY ${orderSql}, cd.id ASC${paging}`,
    { ...replacements, limit, offset }
  );
  if (rows.length === 0) return [];

  const docs = await ComplianceDocument.findAll({ where: { tenantId, id: rows.map((r) => r.id) } });
  const byId = new Map(docs.map((doc) => [doc.id, doc]));

  return rows.map((row) => {
    const doc = byId.get(row.id);
    const assetLabel =
      doc.assetType === ASSET_TYPES.VEHICLE
        ? row.registrationNumber
        : Machinery.label({ rcpl: row.rcpl, name: row.machineName, assetId: doc.assetId });
    return { ...toPublic(doc), assetLabel, assetRecordId: row.assetRecordId, siteId: row.siteId };
  });
}

const EXPIRY_COUNTS = `COUNT(*) AS total,
            SUM(cd.expiry_date < :today) AS expired,
            SUM(cd.expiry_date >= :today AND cd.expiry_date <= :warnUntil) AS expiringSoon,
            SUM(cd.expiry_date > :warnUntil) AS valid,
            SUM(cd.expiry_date IS NULL) AS noExpiry`;

function readCounts(row) {
  return {
    total: num(row.total),
    expired: num(row.expired),
    expiringSoon: num(row.expiringSoon),
    valid: num(row.valid),
    noExpiry: num(row.noExpiry),
  };
}

async function countByExpiry(conditions, replacements) {
  const [row] = await select(
    `SELECT ${EXPIRY_COUNTS}
       ${ASSET_JOINS}
       ${whereSql(conditions)}`,
    replacements
  );
  return readCounts(row);
}

async function listCompliance({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: Object.keys(SORT_COLUMNS),
    defaultSort: DEFAULT_SORT,
  });
  const [[field, direction]] = order;
  const byExpiry = `cd.expiry_date IS NULL, cd.expiry_date`;
  const orderSql =
    field === 'expiryDate'
      ? `${byExpiry} ${direction}`
      : `${SORT_COLUMNS[field]} ${direction}, ${byExpiry} ASC`;

  const { conditions, replacements } = buildScope({ tenantId, auth, query });
  const expiry = parseEnumFilter(query.expiry, Object.keys(EXPIRY_FILTERS), 'Expiry filter');
  const filtered = expiry ? [...conditions, EXPIRY_FILTERS[expiry]] : conditions;

  const [summary, filteredCount, rows] = await Promise.all([
    countByExpiry(conditions, replacements),
    expiry ? countByExpiry(filtered, replacements) : null,
    findDocuments(tenantId, filtered, replacements, { orderSql, limit, offset }),
  ]);
  const total = (filteredCount ?? summary).total;

  return { ...buildListResponse(rows, { page, limit, total }), summary };
}

async function getComplianceAlerts({ tenantId, auth, query }) {
  const { conditions, replacements } = buildScope({ tenantId, auth, query });
  const data = await findDocuments(tenantId, [...conditions, EXPIRY_FILTERS.ATTENTION], replacements, {
    orderSql: 'cd.expiry_date ASC',
  });

  return {
    data,
    summary: {
      critical: data.filter((doc) => doc.severity === 'CRITICAL').length,
      priority: data.filter((doc) => doc.severity === 'PRIORITY').length,
    },
  };
}

const DASHBOARD_ATTENTION_LIMIT = 50;

async function getComplianceDashboard({ tenantId, auth, query }) {
  const { conditions, replacements } = buildScope({ tenantId, auth, query: { siteId: query.siteId } });
  const where = whereSql(conditions);

  const [[totals], typeRows, attention] = await Promise.all([
    select(
      `SELECT ${EXPIRY_COUNTS},
              COUNT(DISTINCT CASE WHEN cd.expiry_date <= :warnUntil THEN CONCAT(cd.asset_type, ':', cd.asset_id) END) AS assetsAffected
         ${ASSET_JOINS}
         ${where}`,
      replacements
    ),
    select(`SELECT cd.doc_type AS docType, ${EXPIRY_COUNTS} ${ASSET_JOINS} ${where} GROUP BY cd.doc_type`, replacements),
    findDocuments(tenantId, [...conditions, EXPIRY_FILTERS.ATTENTION], replacements, {
      orderSql: 'cd.expiry_date ASC',
      limit: DASHBOARD_ATTENTION_LIMIT,
      offset: 0,
    }),
  ]);

  const byType = new Map(typeRows.map((row) => [row.docType, readCounts(row)]));

  return {
    scope: { siteId: replacements.siteId ?? null },
    warningDays: EXPIRY_WARNING_DAYS,
    summary: { ...readCounts(totals), assetsAffected: num(totals.assetsAffected) },
    byDocType: DOC_TYPES.map((docType) => ({ docType, ...(byType.get(docType) ?? readCounts({})) })),
    attention,
  };
}

module.exports = {
  getComplianceDashboard,
  listComplianceDocuments,
  upsertComplianceDocument,
  saveComplianceDocuments,
  listCompliance,
  getComplianceAlerts,
};
