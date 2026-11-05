const { Op } = require('sequelize');

const { Item } = require('../models');
const AppError = require('../utils/AppError');
const { lockCodeCounter } = require('./codeGenerator');

function assertEditable(record, label) {
  if (record.status === 'archived') {
    throw AppError.conflict(`This ${label} is archived. Restore it before editing.`);
  }
}

// Holds the same lock as number generation, so creates, renames and restores of one type take turns,
// and each one sees what the one before it saved. Call it before the transaction's first plain read.
async function assertNameAvailable({ model, field, codePrefix, label }, { tenantId, name, excludeId, transaction }) {
  await lockCodeCounter(model, codePrefix, { tenantId, transaction });
  const clash = await model.findOne({
    where: { tenantId, status: 'active', [field]: name, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
    attributes: ['id'],
    transaction,
  });
  if (clash) throw AppError.conflict(`${label} named "${name}" already exists.`);
}

// For documents made before an item was archived. The shared lock makes an archive wait until this posting has finished.
async function assertItemsCanTakeStock(tenantId, itemIds, transaction) {
  const items = await Item.findAll({
    where: { tenantId, id: [...new Set(itemIds)] },
    attributes: ['id', 'itemName', 'status'],
    transaction,
    lock: transaction.LOCK.SHARE,
  });
  const archived = items.find((item) => item.status !== 'active');
  if (archived) {
    throw AppError.badRequest(`The item "${archived.itemName}" is archived, so stock can't be added to it. Restore the item first.`);
  }
}

module.exports = { assertEditable, assertNameAvailable, assertItemsCanTakeStock };
