const express = require('express');
const assetDocumentController = require('../controllers/assetDocument.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadSingleDocument } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

// GET /api/documents/:assetType/:assetId
// Admin + Supervisor. Lists uploaded documents (RC, PUC, National Permit,
// Insurance) for one asset. assetType = "VEHICLE" or "MACHINERY".
router.get('/:assetType/:assetId', requirePermission('DOCUMENT', 'READ'), assetDocumentController.list);

// POST /api/documents/:assetType/:assetId/:docType
// Admin + Supervisor. multipart/form-data. Uploads/replaces one document.
// docType = RC | PUC | NATIONAL_PERMIT | INSURANCE. File field name: file
router.post(
  '/:assetType/:assetId/:docType',
  requirePermission('DOCUMENT', 'CREATE'),
  uploadSingleDocument,
  assetDocumentController.upload
);

// GET /api/documents/:assetType/:assetId/:docType/download
// Admin + Supervisor. Downloads the stored file directly (binary response,
// not JSON).
router.get(
  '/:assetType/:assetId/:docType/download',
  requirePermission('DOCUMENT', 'READ'),
  assetDocumentController.download
);

module.exports = router;
