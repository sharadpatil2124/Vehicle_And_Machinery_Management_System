const dashboardService = require('../services/dashboard.service');
const maintenanceService = require('../services/maintenance.service');
const { requireNumber } = require('../utils/validation');

async function summary(req, res) {
  const data = await dashboardService.getSummary({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Dashboard summary retrieved' });
}

async function monthlyCost(req, res) {
  const data = await dashboardService.getMonthlyCost({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Monthly running cost retrieved' });
}

async function fleet(req, res) {
  const data = await dashboardService.getFleet({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Fleet counts retrieved' });
}

async function maintenance(req, res) {
  const siteId = req.query.siteId ? requireNumber(req.query.siteId, 'Site', { min: 1 }) : null;
  const data = await maintenanceService.getDashboardSummary({ tenantId: req.auth.tenantId, auth: req.auth, siteId });
  res.status(200).json({ data, message: 'Maintenance summary retrieved' });
}

module.exports = { summary, monthlyCost, fleet, maintenance };
