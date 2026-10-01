const express = require('express');
const stockAdjustmentController = require('../controllers/stockAdjustment.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('STOCK_ADJUSTMENT', 'READ'), stockAdjustmentController.list);

router.post('/', requirePermission('STOCK_ADJUSTMENT', 'CREATE'), stockAdjustmentController.create);

router.get('/:id', requirePermission('STOCK_ADJUSTMENT', 'READ'), stockAdjustmentController.get);

module.exports = router;
