const itemCategoryService = require('../services/itemCategory.service');

async function list(req, res) {
  const response = await itemCategoryService.listItemCategories({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Item categories retrieved' });
}

async function get(req, res) {
  const data = await itemCategoryService.getItemCategory({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Item category retrieved' });
}

async function create(req, res) {
  const data = await itemCategoryService.createItemCategory({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Item category created' });
}

async function update(req, res) {
  const data = await itemCategoryService.updateItemCategory({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Item category updated' });
}

async function remove(req, res) {
  const data = await itemCategoryService.deleteItemCategory({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Item category archived successfully' });
}

async function restore(req, res) {
  const data = await itemCategoryService.restoreItemCategory({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Item category restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
