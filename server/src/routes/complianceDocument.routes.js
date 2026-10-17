const express = require('express');
const complianceController = require('../controllers/complianceDocument.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('COMPLIANCE', 'READ'), complianceController.listAll);

router.get('/alerts', requirePermission('COMPLIANCE', 'READ'), complianceController.alerts);

router.get('/:assetType/:assetId', requirePermission('COMPLIANCE', 'READ'), complianceController.list);

router.put(
  '/:assetType/:assetId/:docType',
  requirePermission('COMPLIANCE', 'CREATE'),
  complianceController.upsert
);

module.exports = router;
