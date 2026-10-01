const stockTransferService = require('../services/stockTransfer.service');

async function list(req, res) {
  const response = await stockTransferService.listStockTransfers({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Stock transfers retrieved' });
}

async function get(req, res) {
  const data = await stockTransferService.getStockTransfer({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Stock transfer retrieved' });
}

async function create(req, res) {
  const data = await stockTransferService.createStockTransfer({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Stock transfer dispatched — stock moves when the destination receives it' });
}

async function receive(req, res) {
  const data = await stockTransferService.receiveStockTransfer({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Stock transfer received — source and destination stock have been updated' });
}

module.exports = { list, get, create, receive };
