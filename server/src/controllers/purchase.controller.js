const purchaseService = require('../services/purchase.service');

async function list(req, res) {
  const response = await purchaseService.listPurchases({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Purchases retrieved' });
}

async function get(req, res) {
  const data = await purchaseService.getPurchase({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Purchase retrieved' });
}

async function create(req, res) {
  const data = await purchaseService.createPurchase({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Purchase created' });
}

async function update(req, res) {
  const data = await purchaseService.updatePurchase({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Purchase updated' });
}

async function receive(req, res) {
  const data = await purchaseService.receivePurchase({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Purchase received — stock has been updated' });
}

module.exports = { list, get, create, update, receive };
