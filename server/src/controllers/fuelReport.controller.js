const fuelReportService = require('../services/fuelReport.service');

const ctx = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });

async function siteRegister(req, res) {
  const data = await fuelReportService.siteRegister(ctx(req));
  res.status(200).json({ data, message: 'Site fuel register retrieved' });
}

async function assetConsumption(req, res) {
  const data = await fuelReportService.assetConsumption(ctx(req));
  res.status(200).json({ data, message: 'Fuel consumption by asset retrieved' });
}

async function collections(req, res) {
  const data = await fuelReportService.collectionsSummary(ctx(req));
  res.status(200).json({ data, message: 'Fuel collections summary retrieved' });
}

async function collectionsByStation(req, res) {
  const data = await fuelReportService.collectionsByStation(ctx(req));
  res.status(200).json({ data, message: 'Fuel collections by station retrieved' });
}

async function collectionsByCarrier(req, res) {
  const data = await fuelReportService.collectionsByCarrier(ctx(req));
  res.status(200).json({ data, message: 'Fuel collections by carrier retrieved' });
}

module.exports = { siteRegister, assetConsumption, collections, collectionsByStation, collectionsByCarrier };
