const tyreTypeService = require('../services/tyreType.service');
const tyrePurchaseService = require('../services/tyrePurchase.service');
const tyreStockService = require('../services/tyreStock.service');
const tyreFitmentService = require('../services/tyreFitment.service');
const tyreReportService = require('../services/tyreReport.service');

const ctx = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, actingUserId: req.auth.userId });

async function listTypes(req, res) {
  const response = await tyreTypeService.listTyreTypes({ ...ctx(req), query: req.query });
  res.status(200).json({ ...response, message: 'Tyre types retrieved' });
}

async function createType(req, res) {
  const data = await tyreTypeService.createTyreType({ ...ctx(req), payload: req.body ?? {} });
  res.status(201).json({ data, message: 'Tyre type added' });
}

async function updateType(req, res) {
  const data = await tyreTypeService.updateTyreType({ ...ctx(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre type updated' });
}

async function listPurchases(req, res) {
  const response = await tyrePurchaseService.listTyrePurchases({ ...ctx(req), query: req.query });
  res.status(200).json({ ...response, message: 'Tyre purchases retrieved' });
}

async function getPurchase(req, res) {
  const data = await tyrePurchaseService.getTyrePurchase({ ...ctx(req), id: req.params.id });
  res.status(200).json({ data, message: 'Tyre purchase retrieved' });
}

async function createPurchase(req, res) {
  const data = await tyrePurchaseService.createTyrePurchase({ ...ctx(req), payload: req.body ?? {} });
  res.status(201).json({ data, message: 'Tyre purchase saved' });
}

async function cancelPurchase(req, res) {
  const data = await tyrePurchaseService.cancelTyrePurchase({ ...ctx(req), id: req.params.id, confirmation: req.body?.confirmation });
  res.status(200).json({ data, message: 'Tyre purchase cancelled' });
}

async function stock(req, res) {
  const data = await tyreStockService.listTyreStock({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyre stock retrieved' });
}

async function listFitments(req, res) {
  const response = await tyreFitmentService.listFitments({ ...ctx(req), query: req.query });
  res.status(200).json({ ...response, message: 'Tyre fittings retrieved' });
}

async function fit(req, res) {
  const data = await tyreFitmentService.fitTyres({ ...ctx(req), payload: req.body ?? {} });
  res.status(201).json({ data, message: `${data.length} ${data.length === 1 ? 'tyre' : 'tyres'} fitted` });
}

async function updateFitment(req, res) {
  const data = await tyreFitmentService.updateFitment({ ...ctx(req), id: req.params.id, payload: req.body ?? {} });
  res.status(200).json({ data, message: 'Tyre fitting updated' });
}

async function assetReport(req, res) {
  const data = await tyreReportService.assetReport({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyre report by asset retrieved' });
}

async function assetTyres(req, res) {
  const data = await tyreReportService.assetTyres({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyres for asset retrieved' });
}

async function costReport(req, res) {
  const data = await tyreReportService.costReport({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyre cost report retrieved' });
}

async function costsByType(req, res) {
  const data = await tyreReportService.costsByType({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyre costs by type retrieved' });
}

async function costsBySupplier(req, res) {
  const data = await tyreReportService.costsBySupplier({ ...ctx(req), query: req.query });
  res.status(200).json({ data, message: 'Tyre costs by supplier retrieved' });
}

module.exports = {
  listTypes,
  createType,
  updateType,
  listPurchases,
  getPurchase,
  createPurchase,
  cancelPurchase,
  stock,
  listFitments,
  fit,
  updateFitment,
  assetReport,
  assetTyres,
  costReport,
  costsByType,
  costsBySupplier,
};
