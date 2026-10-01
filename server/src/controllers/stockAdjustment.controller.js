const stockAdjustmentService = require('../services/stockAdjustment.service');

async function list(req, res) {
  const response = await stockAdjustmentService.listStockAdjustments({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Stock adjustments retrieved' });
}

async function get(req, res) {
  const data = await stockAdjustmentService.getStockAdjustment({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Stock adjustment retrieved' });
}

async function create(req, res) {
  const data = await stockAdjustmentService.createStockAdjustment({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Stock adjustment recorded — stock has been updated' });
}

module.exports = { list, get, create };
