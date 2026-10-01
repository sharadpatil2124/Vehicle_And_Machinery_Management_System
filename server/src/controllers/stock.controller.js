const stockService = require('../services/stock.service');

async function balances(req, res) {
  const response = await stockService.listStockBalances({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Stock balances retrieved' });
}

async function transactions(req, res) {
  const response = await stockService.listInventoryTransactions({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Inventory transactions retrieved' });
}

module.exports = { balances, transactions };
