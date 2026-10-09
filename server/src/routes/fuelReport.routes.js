const express = require('express');
const fuelReportController = require('../controllers/fuelReport.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/site-register', requirePermission('REPORTS', 'VIEW'), fuelReportController.siteRegister);

router.get('/asset-consumption', requirePermission('REPORTS', 'VIEW'), fuelReportController.assetConsumption);

router.get('/collections', requirePermission('REPORTS', 'VIEW'), fuelReportController.collections);

module.exports = router;
