const express = require('express');
const inventoryReportController = require('../controllers/inventoryReport.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/stock-register', requirePermission('REPORTS', 'VIEW'), inventoryReportController.stockRegister);

router.get('/purchases', requirePermission('REPORTS', 'VIEW'), inventoryReportController.purchases);

router.get('/purchases/by-supplier', requirePermission('REPORTS', 'VIEW'), inventoryReportController.purchasesBySupplier);

router.get('/purchases/by-item', requirePermission('REPORTS', 'VIEW'), inventoryReportController.purchasesByItem);

router.get('/parts-by-asset', requirePermission('REPORTS', 'VIEW'), inventoryReportController.partsByAsset);

module.exports = router;
