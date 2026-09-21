const machineryService = require('../services/machinery.service');
const { AssetDocument } = require('../models');

function readAssetDocumentFiles(files) {
  const result = {};
  for (const docType of AssetDocument.DOC_TYPES) {
    result[docType] = files?.[docType]?.[0];
  }
  return result;
}

async function list(req, res) {
  const response = await machineryService.listMachinery({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ ...response, message: 'Machinery retrieved' });
}

async function get(req, res) {
  const data = await machineryService.getMachine({ tenantId: req.auth.tenantId, auth: req.auth, id: req.params.id });
  res.status(200).json({ data, message: 'Machine retrieved' });
}

async function create(req, res) {
  const data = await machineryService.createMachine({
    tenantId: req.auth.tenantId, auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
    files: readAssetDocumentFiles(req.files),
  });
  res.status(201).json({ data, message: 'Machine created' });
}

async function update(req, res) {
  const data = await machineryService.updateMachine({
    tenantId: req.auth.tenantId, auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Machine updated' });
}

async function remove(req, res) {
  const data = await machineryService.deleteMachine({
    tenantId: req.auth.tenantId, auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Machine archived successfully' });
}

async function restore(req, res) {
  const data = await machineryService.restoreMachine({
    tenantId: req.auth.tenantId, auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Machine restored successfully' });
}

async function history(req, res) {
  const data = await machineryService.getMachineHistory({ tenantId: req.auth.tenantId, auth: req.auth, id: req.params.id });
  res.status(200).json({ data, message: 'Machine history retrieved' });
}

module.exports = { list, get, create, update, remove, restore, history };
