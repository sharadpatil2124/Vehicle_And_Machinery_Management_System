const complianceService = require('../services/complianceDocument.service');

async function listAll(req, res) {
  const response = await complianceService.listCompliance({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Compliance documents retrieved' });
}

async function alerts(req, res) {
  const response = await complianceService.getComplianceAlerts({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Compliance alerts retrieved' });
}

async function list(req, res) {
  const data = await complianceService.listComplianceDocuments({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
  });
  res.status(200).json({ data, message: 'Compliance documents retrieved' });
}

async function upsert(req, res) {
  const data = await complianceService.upsertComplianceDocument({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
    docType: req.params.docType?.toUpperCase(),
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Compliance document saved' });
}

module.exports = { listAll, alerts, list, upsert };
