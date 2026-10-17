const express = require('express');
const fuelReportController = require('../controllers/fuelReport.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/site-register', requirePermission('REPORTS', 'VIEW'), fuelReportController.siteRegister);

router.get('/asset-consumption', requirePermission('REPORTS', 'VIEW'), fuelReportController.assetConsumption);

router.get('/collections', requirePermission('REPORTS', 'VIEW'), fuelReportController.collections);

router.get('/collections/by-station', requirePermission('REPORTS', 'VIEW'), fuelReportController.collectionsByStation);

router.get('/collections/by-carrier', requirePermission('REPORTS', 'VIEW'), fuelReportController.collectionsByCarrier);

module.exports = router;
