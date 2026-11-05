const adblueService = require('../services/adblue.service');

const read = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, query: req.query });
const one = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, id: req.params.id });
const write = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, actingUserId: req.auth.userId, id: req.params.id, payload: req.body ?? {} });
const remove = (req) => ({ tenantId: req.auth.tenantId, auth: req.auth, actingUserId: req.auth.userId, id: req.params.id, confirmation: req.body?.confirmation });

async function overview(req, res) {
  const data = await adblueService.getOverview(read(req));
  res.status(200).json({ data, message: 'AdBlue overview retrieved' });
}

async function reports(req, res) {
  const data = await adblueService.getReports(read(req));
  res.status(200).json({ data, message: 'AdBlue reports retrieved' });
}

async function listPurchases(req, res) {
  const response = await adblueService.listPurchases(read(req));
  res.status(200).json({ ...response, message: 'AdBlue purchases retrieved' });
}

async function getPurchase(req, res) {
  const data = await adblueService.getPurchase(one(req));
  res.status(200).json({ data, message: 'AdBlue purchase retrieved' });
}

async function createPurchase(req, res) {
  const data = await adblueService.createPurchase(write(req));
  res.status(201).json({ data, message: 'AdBlue purchase recorded' });
}

async function updatePurchase(req, res) {
  const data = await adblueService.updatePurchase(write(req));
  res.status(200).json({ data, message: 'AdBlue purchase updated' });
}

async function deletePurchase(req, res) {
  const data = await adblueService.deletePurchase(remove(req));
  res.status(200).json({ data, message: 'AdBlue purchase deleted' });
}

async function listFillings(req, res) {
  const response = await adblueService.listFillings(read(req));
  res.status(200).json({ ...response, message: 'AdBlue fillings retrieved' });
}

async function getFilling(req, res) {
  const data = await adblueService.getFilling(one(req));
  res.status(200).json({ data, message: 'AdBlue filling retrieved' });
}

async function createFilling(req, res) {
  const data = await adblueService.createFilling(write(req));
  res.status(201).json({ data, message: 'AdBlue filling recorded' });
}

async function updateFilling(req, res) {
  const data = await adblueService.updateFilling(write(req));
  res.status(200).json({ data, message: 'AdBlue filling updated' });
}

async function deleteFilling(req, res) {
  const data = await adblueService.deleteFilling(remove(req));
  res.status(200).json({ data, message: 'AdBlue filling deleted' });
}

module.exports = {
  overview,
  reports,
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  listFillings,
  getFilling,
  createFilling,
  updateFilling,
  deleteFilling,
};
