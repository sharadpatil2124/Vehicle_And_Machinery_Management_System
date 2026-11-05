const maintenanceService = require('../services/maintenance.service');

async function list(req, res) {
  const response = await maintenanceService.listMaintenance({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Maintenance records retrieved' });
}

async function preventiveSchedule(req, res) {
  const data = await maintenanceService.getPreventiveSchedule({
    tenantId: req.auth.tenantId,
    auth: req.auth,
  });
  res.status(200).json({ data, message: 'Preventive maintenance schedule retrieved' });
}

async function preventiveScheduleAssets(req, res) {
  const response = await maintenanceService.listPreventiveSchedule({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Preventive maintenance schedule retrieved' });
}

async function get(req, res) {
  const data = await maintenanceService.getMaintenance({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Maintenance record retrieved' });
}

async function create(req, res) {
  const data = await maintenanceService.createMaintenance({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({
    data,
    message: data.type === 'breakdown' ? 'Breakdown reported' : 'Preventive maintenance scheduled',
  });
}

async function update(req, res) {
  const data = await maintenanceService.updateMaintenance({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Maintenance record updated' });
}

async function changeStage(req, res) {
  const data = await maintenanceService.changeStage({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: data.stage === 'resolved' ? 'Maintenance resolved' : 'Work started' });
}

async function remove(req, res) {
  const data = await maintenanceService.deleteMaintenance({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Maintenance record deleted' });
}

async function correctCost(req, res) {
  const data = await maintenanceService.correctMaintenanceCost({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Maintenance cost corrected' });
}

module.exports = { list, preventiveSchedule, preventiveScheduleAssets, get, create, update, changeStage, remove, correctCost };
