const complianceService = require('../services/complianceDocument.service');

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

module.exports = { list, upsert };
