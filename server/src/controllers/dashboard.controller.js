const dashboardService = require('../services/dashboard.service');

async function summary(req, res) {
  const data = await dashboardService.getSummary({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Dashboard summary retrieved' });
}

module.exports = { summary };
