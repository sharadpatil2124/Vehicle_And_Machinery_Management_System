const unitOfMeasureService = require('../services/unitOfMeasure.service');

async function list(req, res) {
  const response = await unitOfMeasureService.listUnitsOfMeasure({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Units of measure retrieved' });
}

async function get(req, res) {
  const data = await unitOfMeasureService.getUnitOfMeasure({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Unit of measure retrieved' });
}

async function create(req, res) {
  const data = await unitOfMeasureService.createUnitOfMeasure({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Unit of measure created' });
}

async function update(req, res) {
  const data = await unitOfMeasureService.updateUnitOfMeasure({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Unit of measure updated' });
}

async function remove(req, res) {
  const data = await unitOfMeasureService.deleteUnitOfMeasure({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Unit of measure archived successfully' });
}

async function restore(req, res) {
  const data = await unitOfMeasureService.restoreUnitOfMeasure({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Unit of measure restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
