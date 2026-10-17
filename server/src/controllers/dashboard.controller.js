const dashboardService = require('../services/dashboard.service');

async function summary(req, res) {
  const data = await dashboardService.getSummary({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Dashboard summary retrieved' });
}

async function monthlyCost(req, res) {
  const data = await dashboardService.getMonthlyCost({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Monthly running cost retrieved' });
}

module.exports = { summary, monthlyCost };
