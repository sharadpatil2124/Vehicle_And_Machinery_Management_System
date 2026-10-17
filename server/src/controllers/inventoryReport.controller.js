const inventoryReportService = require('../services/inventoryReport.service');

const ctx = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });

async function stockRegister(req, res) {
  const data = await inventoryReportService.stockRegister(ctx(req));
  res.status(200).json({ data, message: 'Stock register retrieved' });
}

async function purchases(req, res) {
  const data = await inventoryReportService.purchases(ctx(req));
  res.status(200).json({ data, message: 'Purchases summary retrieved' });
}

async function purchasesBySupplier(req, res) {
  const data = await inventoryReportService.purchasesBySupplier(ctx(req));
  res.status(200).json({ data, message: 'Purchases by supplier retrieved' });
}

async function purchasesByItem(req, res) {
  const data = await inventoryReportService.purchasesByItem(ctx(req));
  res.status(200).json({ data, message: 'Purchases by item retrieved' });
}

async function partsByAsset(req, res) {
  const data = await inventoryReportService.partsByAsset(ctx(req));
  res.status(200).json({ data, message: 'Parts used by asset retrieved' });
}

module.exports = { stockRegister, purchases, purchasesBySupplier, purchasesByItem, partsByAsset };
