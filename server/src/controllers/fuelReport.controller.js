const fuelReportService = require('../services/fuelReport.service');

async function siteRegister(req, res) {
  const data = await fuelReportService.siteRegister({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Site fuel register retrieved' });
}

async function assetConsumption(req, res) {
  const data = await fuelReportService.assetConsumption({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Fuel consumption by asset retrieved' });
}

async function collections(req, res) {
  const data = await fuelReportService.collectionsSummary({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Fuel collections summary retrieved' });
}

module.exports = { siteRegister, assetConsumption, collections };
