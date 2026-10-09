const inventoryReportService = require('../services/inventoryReport.service');

async function stockRegister(req, res) {
  const data = await inventoryReportService.stockRegister({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Stock register retrieved' });
}

async function purchases(req, res) {
  const data = await inventoryReportService.purchases({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Purchases summary retrieved' });
}

async function partsByAsset(req, res) {
  const data = await inventoryReportService.partsByAsset({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
  res.status(200).json({ data, message: 'Parts used by asset retrieved' });
}

module.exports = { stockRegister, purchases, partsByAsset };
