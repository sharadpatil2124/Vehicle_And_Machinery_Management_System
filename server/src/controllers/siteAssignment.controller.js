const siteAssignmentService = require('../services/siteAssignment.service');

async function history(req, res) {
  const data = await siteAssignmentService.listSiteHistory({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
  });
  res.status(200).json({ data, message: 'Site history retrieved' });
}

module.exports = { history };
