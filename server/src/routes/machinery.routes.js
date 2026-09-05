const express = require('express');
const machineryController = require('../controllers/machinery.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadAssetCreationDocuments } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('MACHINERY', 'READ'), machineryController.list);
router.post(
  '/',
  requirePermission('MACHINERY', 'CREATE'),
  uploadAssetCreationDocuments,
  machineryController.create
);
router.get('/:id', requirePermission('MACHINERY', 'READ'), machineryController.get);
router.put('/:id', requirePermission('MACHINERY', 'UPDATE'), machineryController.update);
router.delete('/:id', requirePermission('MACHINERY', 'DELETE'), machineryController.remove);
router.get('/:id/history', requirePermission('MACHINERY', 'READ'), machineryController.history);

module.exports = router;
