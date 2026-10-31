const express = require('express');
const fuelTransactionController = require('../controllers/fuelTransaction.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam('Fuel transaction not found'));

router.get('/', requirePermission('FUEL', 'READ'), fuelTransactionController.list);

router.post('/', requirePermission('FUEL', 'CREATE'), fuelTransactionController.create);

router.get(
  '/efficiency/:assetType/:assetId',
  requirePermission('FUEL', 'READ'),
  fuelTransactionController.efficiency
);

router.get('/:id', requirePermission('FUEL', 'READ'), fuelTransactionController.get);

router.put('/:id', requirePermission('FUEL', 'UPDATE'), fuelTransactionController.update);

router.delete('/:id', requirePermission('FUEL', 'DELETE'), fuelTransactionController.remove);

module.exports = router;
