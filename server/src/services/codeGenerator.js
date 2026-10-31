const { Op, cast, col, fn } = require('sequelize');

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

async function nextSequentialCode(Model, column, prefix, { tenantId, transaction }) {
  const where = { tenantId, [column]: { [Op.like]: `${prefix}%` } };
  const highestRow = await Model.findOne({ attributes: [column], where, order: [[column, 'DESC']], raw: true, transaction });
  const suffix = highestRow ? highestRow[column].slice(prefix.length) : '';
  const highest = ALL_NINES.test(suffix)
    ? await highestNumericSuffix(Model, column, prefix, where, transaction)
    : Number(suffix || 0);
  return `${prefix}${String(highest + 1).padStart(6, '0')}`;
}

function isCodeCollision(error, constraintName) {
  return error.name === 'SequelizeUniqueConstraintError' && Object.keys(error.fields ?? {}).includes(constraintName);
}

module.exports = { nextSequentialCode, isCodeCollision };
