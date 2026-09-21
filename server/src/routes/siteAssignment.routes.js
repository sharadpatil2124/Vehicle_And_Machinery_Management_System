const express = require('express');
const siteAssignmentController = require('../controllers/siteAssignment.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

// GET /api/site-assignments/:assetType/:assetId
// Admin + Supervisor. Site-transfer history for one asset.
// assetType = "VEHICLE" or "MACHINERY", assetId = the business id (e.g. VEH-000001).
router.get(
  '/:assetType/:assetId',
  requirePermission('SITE', 'READ'),
  siteAssignmentController.history
);

module.exports = router;
