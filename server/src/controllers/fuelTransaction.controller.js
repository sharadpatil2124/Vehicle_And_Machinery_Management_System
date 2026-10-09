const fuelTransactionService = require('../services/fuelTransaction.service');

async function list(req, res) {
  const response = await fuelTransactionService.listFuelTransactions({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Fuel transactions retrieved' });
}

async function get(req, res) {
  const data = await fuelTransactionService.getFuelTransaction({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Fuel transaction retrieved' });
}

async function create(req, res) {
  const data = await fuelTransactionService.createFuelTransaction({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Fuel entry recorded' });
}

async function update(req, res) {
  const data = await fuelTransactionService.updateFuelTransaction({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Fuel entry updated' });
}

async function remove(req, res) {
  const data = await fuelTransactionService.deleteFuelTransaction({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Fuel entry deleted' });
}

async function efficiency(req, res) {
  const data = await fuelTransactionService.getFuelEfficiency({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    assetType: req.params.assetType,
    assetId: req.params.assetId,
  });
  res.status(200).json({ data, message: 'Fuel efficiency retrieved' });
}

module.exports = { list, get, create, update, remove, efficiency };
