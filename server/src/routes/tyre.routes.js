const express = require('express');
const tyreController = require('../controllers/tyre.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('TYRE', 'READ'), tyreController.list);

router.post('/', requirePermission('TYRE', 'CREATE'), tyreController.create);

router.get('/history', requirePermission('TYRE', 'READ'), tyreController.fitments);

router.get('/vehicles/:vehicleId/positions', requirePermission('TYRE', 'READ'), tyreController.vehiclePositions);

router.get('/:id', requirePermission('TYRE', 'READ'), tyreController.get);

router.put('/:id', requirePermission('TYRE', 'UPDATE'), tyreController.update);

router.delete('/:id', requirePermission('TYRE', 'DELETE'), tyreController.remove);

router.post('/:id/restore', requirePermission('TYRE', 'RESTORE'), tyreController.restore);

router.post('/:id/install', requirePermission('TYRE', 'UPDATE'), tyreController.install);

router.post('/:id/remove', requirePermission('TYRE', 'UPDATE'), tyreController.removeFromVehicle);

router.post('/:id/rotate', requirePermission('TYRE', 'UPDATE'), tyreController.rotate);

router.post('/:id/scrap', requirePermission('TYRE', 'UPDATE'), tyreController.scrap);

module.exports = router;
