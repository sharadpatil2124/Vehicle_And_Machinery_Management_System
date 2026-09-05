const express = require('express');
const vehicleController = require('../controllers/vehicle.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadAssetCreationDocuments } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('VEHICLE', 'READ'), vehicleController.list);
router.post(
  '/',
  requirePermission('VEHICLE', 'CREATE'),
  uploadAssetCreationDocuments,
  vehicleController.create
);
router.get('/:id', requirePermission('VEHICLE', 'READ'), vehicleController.get);
router.put('/:id', requirePermission('VEHICLE', 'UPDATE'), vehicleController.update);
router.delete('/:id', requirePermission('VEHICLE', 'DELETE'), vehicleController.remove);
router.get('/:id/history', requirePermission('VEHICLE', 'READ'), vehicleController.history);

module.exports = router;
