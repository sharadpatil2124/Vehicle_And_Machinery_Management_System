const assetIssueService = require('../services/assetIssue.service');

async function list(req, res) {
  const response = await assetIssueService.listAssetIssues({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Asset issues retrieved' });
}

async function get(req, res) {
  const data = await assetIssueService.getAssetIssue({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Asset issue retrieved' });
}

async function create(req, res) {
  const data = await assetIssueService.createAssetIssue({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Asset issue created — stock has been updated' });
}

module.exports = { list, get, create };
