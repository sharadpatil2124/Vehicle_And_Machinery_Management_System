const express = require('express');
const stockTransferController = require('../controllers/stockTransfer.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('STOCK_TRANSFER', 'READ'), stockTransferController.list);

router.post('/', requirePermission('STOCK_TRANSFER', 'CREATE'), stockTransferController.create);

router.get('/:id', requirePermission('STOCK_TRANSFER', 'READ'), stockTransferController.get);

router.post(
  '/:id/receive',
  requirePermission('STOCK_TRANSFER', 'RECEIVE'),
  stockTransferController.receive
);

module.exports = router;
