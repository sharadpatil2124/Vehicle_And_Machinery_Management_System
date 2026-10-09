const tyreService = require('../services/tyre.service');

function context(req) {
  return { tenantId: req.auth.tenantId, auth: req.auth, actingUserId: req.auth.userId };
}

async function list(req, res) {
  const response = await tyreService.listTyres({ ...context(req), query: req.query });
  res.status(200).json({ ...response, message: 'Tyres retrieved' });
}

async function get(req, res) {
  const data = await tyreService.getTyre({ ...context(req), id: req.params.id });
  res.status(200).json({ data, message: 'Tyre retrieved' });
}

async function create(req, res) {
  const data = await tyreService.createTyre({ ...context(req), payload: req.body ?? {} });
  res.status(201).json({ data, message: 'Tyre added' });
}

async function update(req, res) {
  const data = await tyreService.updateTyre({ ...context(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre updated' });
}

async function remove(req, res) {
  const data = await tyreService.deleteTyre({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Tyre archived successfully' });
}

async function restore(req, res) {
  const data = await tyreService.restoreTyre({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Tyre restored successfully' });
}

async function install(req, res) {
  const data = await tyreService.installTyre({ ...context(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre fitted' });
}

async function removeFromVehicle(req, res) {
  const data = await tyreService.removeTyre({ ...context(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre removed' });
}

async function rotate(req, res) {
  const data = await tyreService.rotateTyre({ ...context(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre moved' });
}

async function scrap(req, res) {
  const data = await tyreService.scrapTyre({ ...context(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre scrapped' });
}

async function vehiclePositions(req, res) {
  const data = await tyreService.vehicleTyrePositions({ ...context(req), vehicleId: req.params.vehicleId });
  res.status(200).json({ data, message: 'Tyre positions retrieved' });
}

async function fitments(req, res) {
  const response = await tyreService.listFitments({ ...context(req), query: req.query });
  res.status(200).json({ ...response, message: 'Tyre history retrieved' });
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  restore,
  install,
  removeFromVehicle,
  rotate,
  scrap,
  vehiclePositions,
  fitments,
};
