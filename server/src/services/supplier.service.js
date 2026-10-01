const { Op } = require('sequelize');

const { sequelize, Supplier } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, optionalEmail } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { archiveEntity, restoreEntity } = require('./archive.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');

const repo = createTenantScopedRepository(Supplier);

const SORTABLE_FIELDS = ['createdAt', 'supplierName'];
const DEFAULT_SORT = 'supplierName:asc';

const SUPPLIER_CODE_PREFIX = 'SUP-';
const SUPPLIER_CODE_GENERATION_ATTEMPTS = 5;

function toPublic(supplier) {
  return supplier.toPublicJSON();
}

function readSupplierInput(payload, { partial = false } = {}) {
  const input = {};

  if (!partial || payload.supplierName !== undefined) {
    input.supplierName = requireText(payload.supplierName, 'Supplier name', { max: 255 });
  }
  if (!partial || payload.taxRegistrationNo !== undefined) {
    input.taxRegistrationNo = optionalText(payload.taxRegistrationNo, 'Tax registration number', { max: 64 });
  }
  if (!partial || payload.contactPerson !== undefined) {
    input.contactPerson = optionalText(payload.contactPerson, 'Contact person', { max: 150 });
  }
  if (!partial || payload.phone !== undefined) {
    input.phone = optionalText(payload.phone, 'Phone', { max: 30 });
  }
  if (!partial || payload.email !== undefined) {
    input.email = optionalEmail(payload.email);
  }
  if (!partial || payload.address !== undefined) {
    input.address = optionalText(payload.address, 'Address', { max: 2000 });
  }

  return input;
}

async function listSuppliers({ tenantId, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const status = parseEnumFilter(query.status, Supplier.STATUSES, 'Status') ?? 'active';
  const where = { status };

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where.supplierName = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, { where, order, limit, offset });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getSupplier({ tenantId, id }) {
  const supplier = await repo.findByPk(tenantId, id);
  if (!supplier) throw AppError.notFound('Supplier not found');
  return toPublic(supplier);
}

async function createSupplier({ tenantId, actingUserId, payload }) {
  const input = readSupplierInput(payload);

  const supplier = await sequelize.transaction(async (transaction) => {
    let created;

    for (let attempt = 1; attempt <= SUPPLIER_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const supplierCode = await nextSequentialCode(Supplier, 'supplierCode', SUPPLIER_CODE_PREFIX, {
        tenantId,
        transaction,
      });
      try {
        created = await repo.create(
          tenantId,
          { ...input, supplierCode, createdBy: actingUserId, updatedBy: actingUserId },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === SUPPLIER_CODE_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_suppliers_tenant_code') || isLastAttempt) throw error;
      }
    }

    await recordCreate(
      { tenantId, entityType: 'Supplier', entityId: created.id, performedBy: actingUserId, after: created },
      { transaction }
    );

    return created;
  });

  return toPublic(supplier);
}

async function updateSupplier({ tenantId, actingUserId, id, payload }) {
  const supplier = await repo.findByPk(tenantId, id);
  if (!supplier) throw AppError.notFound('Supplier not found');

  const input = readSupplierInput(payload, { partial: true });

  const before = supplier.toJSON();

  const updated = await sequelize.transaction(async (transaction) => {
    await supplier.update({ ...input, updatedBy: actingUserId }, { transaction });

    await recordUpdate(
      { tenantId, entityType: 'Supplier', entityId: supplier.id, performedBy: actingUserId, before, after: supplier },
      { transaction }
    );

    return supplier;
  });

  return toPublic(updated);
}

async function deleteSupplier({ tenantId, actingUserId, id, confirmation }) {
  const archived = await archiveEntity({
    model: Supplier,
    entityType: 'Supplier',
    tenantId,
    id,
    confirmation,
    performedBy: actingUserId,
  });

  return toPublic(archived);
}

async function restoreSupplier({ tenantId, actingUserId, id }) {
  const restored = await restoreEntity({
    model: Supplier,
    entityType: 'Supplier',
    tenantId,
    id,
    performedBy: actingUserId,
  });

  return toPublic(restored);
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  restoreSupplier,
};
