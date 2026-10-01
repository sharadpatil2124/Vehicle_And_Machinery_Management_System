const express = require('express');
const siteAssignmentController = require('../controllers/siteAssignment.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get(
  '/:assetType/:assetId',
  requirePermission('SITE', 'READ'),
  siteAssignmentController.history
);

module.exports = router;
