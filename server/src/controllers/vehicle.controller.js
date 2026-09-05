const vehicleService = require('../services/vehicle.service');
const { AssetDocument } = require('../models');

function readAssetDocumentFiles(files) {
  const result = {};
  for (const docType of AssetDocument.DOC_TYPES) {
    result[docType] = files?.[docType]?.[0];
  }
  return result;
}

async function list(req, res) {
  const response = await vehicleService.listVehicles({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Vehicles retrieved' });
}

async function get(req, res) {
  const data = await vehicleService.getVehicle({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Vehicle retrieved' });
}

async function create(req, res) {
  const data = await vehicleService.createVehicle({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
    files: readAssetDocumentFiles(req.files),
  });
  res.status(201).json({ data, message: 'Vehicle created' });
}

async function update(req, res) {
  const data = await vehicleService.updateVehicle({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Vehicle updated' });
}

async function remove(req, res) {
  const data = await vehicleService.deleteVehicle({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Vehicle archived successfully' });
}

async function history(req, res) {
  const data = await vehicleService.getVehicleHistory({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Vehicle history retrieved' });
}

module.exports = { list, get, create, update, remove, history };
