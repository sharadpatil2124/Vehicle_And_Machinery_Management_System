const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/summary', requirePermission('DASHBOARD', 'VIEW_SUMMARY_METRICS'), dashboardController.summary);

module.exports = router;
