const { Op } = require('sequelize');

async function nextSequentialCode(Model, column, prefix, { tenantId, transaction }) {
  const highest = await Model.max(column, {
    where: { tenantId, [column]: { [Op.like]: `${prefix}%` } },
    transaction,
  });
  const nextNumber = highest ? Number(highest.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
}

function isCodeCollision(error, constraintName) {
  return error.name === 'SequelizeUniqueConstraintError' && Object.keys(error.fields ?? {}).includes(constraintName);
}

module.exports = { nextSequentialCode, isCodeCollision };
