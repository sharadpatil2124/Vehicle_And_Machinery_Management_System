const express = require('express');
const stockController = require('../controllers/stock.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/balances', requirePermission('STOCK', 'READ'), stockController.balances);

router.get('/transactions', requirePermission('STOCK', 'READ'), stockController.transactions);

module.exports = router;
