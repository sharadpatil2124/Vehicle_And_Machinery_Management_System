const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/summary', requirePermission('DASHBOARD', 'VIEW_SUMMARY_METRICS'), dashboardController.summary);
router.get('/monthly-cost', requirePermission('DASHBOARD', 'VIEW_SUMMARY_METRICS'), dashboardController.monthlyCost);
router.get('/fleet', requirePermission('DASHBOARD', 'VIEW_SUMMARY_METRICS'), dashboardController.fleet);
router.get('/maintenance', requirePermission('MAINTENANCE', 'READ'), dashboardController.maintenance);

module.exports = router;
