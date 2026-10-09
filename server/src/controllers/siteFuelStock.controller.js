const fuelStockService = require('../services/fuelStock.service');

async function list(req, res) {
  const response = await fuelStockService.listSiteFuelStock({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Site fuel stock retrieved' });
}

async function ledger(req, res) {
  const response = await fuelStockService.listFuelLedger({
    tenantId: req.auth.tenantId,
    auth: req.auth,
    query: req.query,
  });
  res.status(200).json({ ...response, message: 'Fuel stock movements retrieved' });
}

module.exports = { list, ledger };
