const fuelCollectionService = require('../services/fuelCollection.service');

async function list(req, res) {
  const response = await fuelCollectionService.listFuelCollections({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Fuel collections retrieved' });
}

async function get(req, res) {
  const data = await fuelCollectionService.getFuelCollection({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Fuel collection retrieved' });
}

async function create(req, res) {
  const data = await fuelCollectionService.createFuelCollection({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Fuel collection recorded — it is in transit until the site receives it' });
}

async function update(req, res) {
  const data = await fuelCollectionService.updateFuelCollection({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Fuel collection updated' });
}

async function receive(req, res) {
  const data = await fuelCollectionService.receiveFuelCollection({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Fuel received — the litres received were added to site stock' });
}

async function cancel(req, res) {
  const data = await fuelCollectionService.cancelFuelCollection({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Fuel collection cancelled' });
}

module.exports = { list, get, create, update, receive, cancel };
