const express = require('express');
const assetDocumentController = require('../controllers/assetDocument.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadSingleDocument } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

router.get('/:assetType/:assetId', requirePermission('DOCUMENT', 'READ'), assetDocumentController.list);
router.post(
  '/:assetType/:assetId/:docType',
  requirePermission('DOCUMENT', 'CREATE'),
  uploadSingleDocument,
  assetDocumentController.upload
);
router.get(
  '/:assetType/:assetId/:docType/download',
  requirePermission('DOCUMENT', 'READ'),
  assetDocumentController.download
);

module.exports = router;
