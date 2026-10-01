const express = require('express');
const purchaseController = require('../controllers/purchase.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('PURCHASE', 'READ'), purchaseController.list);

router.post('/', requirePermission('PURCHASE', 'CREATE'), purchaseController.create);

router.get('/:id', requirePermission('PURCHASE', 'READ'), purchaseController.get);

router.put('/:id', requirePermission('PURCHASE', 'UPDATE'), purchaseController.update);

router.post('/:id/receive', requirePermission('PURCHASE', 'RECEIVE'), purchaseController.receive);

module.exports = router;
