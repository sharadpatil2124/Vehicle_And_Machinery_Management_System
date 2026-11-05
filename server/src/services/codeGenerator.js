const { Op, QueryTypes, cast, col, fn } = require('sequelize');
const { sequelize } = require('../config/database');

const ALL_NINES = /^9+$/;

async function highestNumericSuffix(Model, column, prefix, where, transaction) {
  const field = Model.getAttributes()[column].field;
  const [row] = await Model.findAll({
    attributes: [[fn('MAX', cast(fn('SUBSTRING', col(field), prefix.length + 1), 'UNSIGNED')), 'highest']],
    where,
    raw: true,
    transaction,
  });
  return Number(row?.highest ?? 0);
}

// Holds the row lock until the transaction ends, so simultaneous creates of one type in one organization
// take turns. A rolled-back create rolls its number back too, so no gaps appear.
async function lockCounter(tenantId, counterKey, transaction) {
  await sequelize.query(
    'INSERT INTO code_counters (tenant_id, counter_key, highest_used) VALUES (:tenantId, :counterKey, 0) ON DUPLICATE KEY UPDATE highest_used = highest_used',
    { replacements: { tenantId, counterKey }, transaction }
  );
  const [row] = await sequelize.query(
    'SELECT highest_used AS highestUsed FROM code_counters WHERE tenant_id = :tenantId AND counter_key = :counterKey FOR UPDATE',
    { replacements: { tenantId, counterKey }, type: QueryTypes.SELECT, transaction }
  );
  return Number(row.highestUsed);
}

async function highestExistingCode(Model, column, prefix, tenantId, transaction) {
  const where = { tenantId, [column]: { [Op.like]: `${prefix}%` } };
  const highestRow = await Model.findOne({ attributes: [column], where, order: [[column, 'DESC']], raw: true, transaction });
  const suffix = highestRow ? highestRow[column].slice(prefix.length) : '';
  return ALL_NINES.test(suffix)
    ? highestNumericSuffix(Model, column, prefix, where, transaction)
    : Number(suffix || 0);
}

async function nextSequentialCode(Model, column, prefix, { tenantId, transaction }) {
  if (!transaction) {
    return sequelize.transaction((own) => nextSequentialCode(Model, column, prefix, { tenantId, transaction: own }));
  }

  const counterKey = `${Model.tableName}:${prefix}`;
  const counter = await lockCounter(tenantId, counterKey, transaction);
  // The table is checked too: it fills a new counter from existing codes and respects imported ones.
  const next = Math.max(counter, await highestExistingCode(Model, column, prefix, tenantId, transaction)) + 1;
  await sequelize.query(
    'UPDATE code_counters SET highest_used = :next WHERE tenant_id = :tenantId AND counter_key = :counterKey',
    { replacements: { next, tenantId, counterKey }, transaction }
  );
  return `${prefix}${String(next).padStart(6, '0')}`;
}

// The lock nextSequentialCode takes, for work that must take turns with creates of this type.
async function lockCodeCounter(Model, prefix, { tenantId, transaction }) {
  await lockCounter(tenantId, `${Model.tableName}:${prefix}`, transaction);
}

function isCodeCollision(error, constraintName) {
  return error.name === 'SequelizeUniqueConstraintError' && Object.keys(error.fields ?? {}).includes(constraintName);
}

module.exports = { nextSequentialCode, lockCodeCounter, isCodeCollision };
