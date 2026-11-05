const express = require('express');
const tyreController = require('../controllers/tyre.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const TYRE_NOT_FOUND = Object.freeze({
  types: 'Tyre type not found',
  purchases: 'Tyre purchase not found',
  fitments: 'Tyre fitting not found',
});

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam((req) => TYRE_NOT_FOUND[req.path.split('/')[1]]));

router.get('/types', requirePermission('TYRE', 'READ'), tyreController.listTypes);

router.post('/types', requirePermission('TYRE', 'CREATE'), tyreController.createType);

router.put('/types/:id', requirePermission('TYRE', 'UPDATE'), tyreController.updateType);

router.get('/purchases', requirePermission('TYRE', 'READ'), tyreController.listPurchases);

router.post('/purchases', requirePermission('TYRE', 'CREATE'), tyreController.createPurchase);

router.get('/purchases/:id', requirePermission('TYRE', 'READ'), tyreController.getPurchase);

router.delete('/purchases/:id', requirePermission('TYRE', 'DELETE'), tyreController.cancelPurchase);

router.get('/stock', requirePermission('TYRE', 'READ'), tyreController.stock);

router.get('/fitments', requirePermission('TYRE', 'READ'), tyreController.listFitments);

router.post('/fitments', requirePermission('TYRE', 'CREATE'), tyreController.fit);

router.put('/fitments/:id', requirePermission('TYRE', 'UPDATE'), tyreController.updateFitment);

router.get('/reports/assets', requirePermission('REPORTS', 'VIEW'), tyreController.assetReport);

router.get('/reports/assets/tyres', requirePermission('REPORTS', 'VIEW'), tyreController.assetTyres);

router.get('/reports/costs', requirePermission('REPORTS', 'VIEW'), tyreController.costReport);

router.get('/reports/costs/by-type', requirePermission('REPORTS', 'VIEW'), tyreController.costsByType);

router.get('/reports/costs/by-supplier', requirePermission('REPORTS', 'VIEW'), tyreController.costsBySupplier);

module.exports = router;
