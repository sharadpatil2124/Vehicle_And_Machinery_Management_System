const express = require('express');
const fuelStationController = require('../controllers/fuelStation.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam('Fuel station not found'));

router.get('/', requirePermission('FUEL_STATION', 'READ'), fuelStationController.list);

router.post('/', requirePermission('FUEL_STATION', 'CREATE'), fuelStationController.create);

router.get('/:id', requirePermission('FUEL_STATION', 'READ'), fuelStationController.get);

router.put('/:id', requirePermission('FUEL_STATION', 'UPDATE'), fuelStationController.update);

router.delete('/:id', requirePermission('FUEL_STATION', 'DELETE'), fuelStationController.remove);

router.post('/:id/restore', requirePermission('FUEL_STATION', 'RESTORE'), fuelStationController.restore);

module.exports = router;
