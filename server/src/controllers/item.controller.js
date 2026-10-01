const itemService = require('../services/item.service');

async function list(req, res) {
  const response = await itemService.listItems({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Items retrieved' });
}

async function get(req, res) {
  const data = await itemService.getItem({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Item retrieved' });
}

async function create(req, res) {
  const data = await itemService.createItem({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Item created' });
}

async function update(req, res) {
  const data = await itemService.updateItem({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Item updated' });
}

async function remove(req, res) {
  const data = await itemService.deleteItem({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Item archived successfully' });
}

async function restore(req, res) {
  const data = await itemService.restoreItem({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Item restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
