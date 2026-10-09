const express = require('express');
const siteFuelStockController = require('../controllers/siteFuelStock.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('FUEL_STOCK', 'READ'), siteFuelStockController.list);

router.get('/ledger', requirePermission('FUEL_STOCK', 'READ'), siteFuelStockController.ledger);

module.exports = router;
