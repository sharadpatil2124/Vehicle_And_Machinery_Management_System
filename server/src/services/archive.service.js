const { sequelize } = require('../config/database');
const AppError = require('../utils/AppError');
const { recordArchive, recordRestore } = require('./audit.service');

async function archiveEntity({
  model,
  entityType,
  tenantId,
  id,
  confirmation,
  performedBy,
  dependencyCheck,
}) {
  if (confirmation !== 'DELETE') {
    throw AppError.badRequest('Type DELETE to confirm this action.');
  }

  return sequelize.transaction(async (transaction) => {
    const record = await model.findOne({ where: { id, tenantId }, transaction });
    if (!record) {
      throw AppError.notFound(`${entityType} not found`);
    }
    if (record.status === 'archived') {
      throw AppError.conflict(`${entityType} is already archived`);
    }

    if (dependencyCheck) {
      await dependencyCheck(record, { transaction });
    }

    await record.update(
      { status: 'archived', archivedAt: new Date(), archivedBy: performedBy },
      { transaction }
    );

    await recordArchive(
      { tenantId, entityType, entityId: record.id, performedBy },
      { transaction }
    );

    return record;
  });
}

async function restoreEntity({ model, entityType, tenantId, id, performedBy }) {
  return sequelize.transaction(async (transaction) => {
    const record = await model.findOne({ where: { id, tenantId }, transaction });
    if (!record) {
      throw AppError.notFound(`${entityType} not found`);
    }
    if (record.status !== 'archived') {
      throw AppError.conflict(`${entityType} is not archived`);
    }

    await record.update(
      { status: 'active', archivedAt: null, archivedBy: null },
      { transaction }
    );

    await recordRestore(
      { tenantId, entityType, entityId: record.id, performedBy },
      { transaction }
    );

    return record;
  });
}

module.exports = { archiveEntity, restoreEntity };
