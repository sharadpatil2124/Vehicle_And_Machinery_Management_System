const fuelStationService = require('../services/fuelStation.service');

async function list(req, res) {
  const response = await fuelStationService.listFuelStations({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Fuel stations retrieved' });
}

async function get(req, res) {
  const data = await fuelStationService.getFuelStation({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Fuel station retrieved' });
}

async function create(req, res) {
  const data = await fuelStationService.createFuelStation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Fuel station created' });
}

async function update(req, res) {
  const data = await fuelStationService.updateFuelStation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Fuel station updated' });
}

async function remove(req, res) {
  const data = await fuelStationService.deleteFuelStation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Fuel station archived successfully' });
}

async function restore(req, res) {
  const data = await fuelStationService.restoreFuelStation({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Fuel station restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
