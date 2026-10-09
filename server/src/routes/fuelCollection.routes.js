const express = require('express');
const fuelCollectionController = require('../controllers/fuelCollection.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('FUEL_COLLECTION', 'READ'), fuelCollectionController.list);

router.post('/', requirePermission('FUEL_COLLECTION', 'CREATE'), fuelCollectionController.create);

router.get('/:id', requirePermission('FUEL_COLLECTION', 'READ'), fuelCollectionController.get);

router.put('/:id', requirePermission('FUEL_COLLECTION', 'UPDATE'), fuelCollectionController.update);

router.post('/:id/receive', requirePermission('FUEL_COLLECTION', 'RECEIVE'), fuelCollectionController.receive);

router.delete('/:id', requirePermission('FUEL_COLLECTION', 'CANCEL'), fuelCollectionController.cancel);

module.exports = router;
