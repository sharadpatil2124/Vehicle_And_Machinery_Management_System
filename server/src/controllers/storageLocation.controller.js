const storageLocationService = require('../services/storageLocation.service');

async function list(req, res) {
  const response = await storageLocationService.listStorageLocations({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Storage locations retrieved' });
}

async function get(req, res) {
  const data = await storageLocationService.getStorageLocation({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Storage location retrieved' });
}

async function create(req, res) {
  const data = await storageLocationService.createStorageLocation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Storage location created' });
}

async function update(req, res) {
  const data = await storageLocationService.updateStorageLocation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Storage location updated' });
}

async function remove(req, res) {
  const data = await storageLocationService.deleteStorageLocation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Storage location archived successfully' });
}

async function restore(req, res) {
  const data = await storageLocationService.restoreStorageLocation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Storage location restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
