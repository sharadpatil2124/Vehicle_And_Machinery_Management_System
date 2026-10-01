const issueReversalService = require('../services/issueReversal.service');

async function create(req, res) {
  const data = await issueReversalService.createIssueReversal({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    assetIssueId: req.body?.assetIssueId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Issue reversed — stock has been updated' });
}

async function get(req, res) {
  const data = await issueReversalService.getIssueReversal({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Issue reversal retrieved' });
}

module.exports = { create, get };
