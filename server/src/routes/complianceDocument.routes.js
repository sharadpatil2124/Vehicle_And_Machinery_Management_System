const express = require('express');
const complianceController = require('../controllers/complianceDocument.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

// GET /api/compliance/:assetType/:assetId
// Admin + Supervisor. Lists all compliance records (Road Tax, Insurance, PUC,
// etc.) for one asset. assetType = "VEHICLE" or "MACHINERY".
router.get('/:assetType/:assetId', requirePermission('COMPLIANCE', 'READ'), complianceController.list);

// PUT /api/compliance/:assetType/:assetId/:docType
// Admin + Supervisor. Creates/updates one compliance record.
// docType = ROAD_TAX | NATIONAL_PERMIT | INSURANCE | STATE_PERMIT | PUC
// Body for date-range types: { startDate: "2026-01-01", expiryDate: "2026-12-31" }
// Body for ROAD_TAX: { roadTaxType: "OTT" } (or "LTT" / "OTHER" + expiryDate)
// Body for NATIONAL_PERMIT: { expiryDate: "..." }
router.put(
  '/:assetType/:assetId/:docType',
  requirePermission('COMPLIANCE', 'CREATE'),
  complianceController.upsert
);

module.exports = router;
