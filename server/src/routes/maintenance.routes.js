const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam('Maintenance record not found'));

router.get('/', requirePermission('MAINTENANCE', 'READ'), maintenanceController.list);

router.post('/', requirePermission('MAINTENANCE', 'CREATE'), maintenanceController.create);

router.get(
  '/preventive-schedule',
  requirePermission('MAINTENANCE', 'READ'),
  maintenanceController.preventiveSchedule
);

router.get(
  '/preventive-schedule/assets',
  requirePermission('MAINTENANCE', 'READ'),
  maintenanceController.preventiveScheduleAssets
);

router.get('/:id', requirePermission('MAINTENANCE', 'READ'), maintenanceController.get);

router.put('/:id', requirePermission('MAINTENANCE', 'UPDATE'), maintenanceController.update);

router.post('/:id/stage', requirePermission('MAINTENANCE', 'UPDATE'), maintenanceController.changeStage);

router.put('/:id/cost', requirePermission('MAINTENANCE', 'UPDATE_COST'), maintenanceController.correctCost);

router.delete('/:id', requirePermission('MAINTENANCE', 'DELETE'), maintenanceController.remove);

module.exports = router;
