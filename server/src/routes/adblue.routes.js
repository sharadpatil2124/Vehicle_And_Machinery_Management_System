const express = require('express');
const adblueController = require('../controllers/adblue.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const purchases = express.Router();
purchases.param('id', validateIdParam('AdBlue purchase not found'));
purchases.get('/', requirePermission('ADBLUE', 'READ'), adblueController.listPurchases);
purchases.post('/', requirePermission('ADBLUE', 'CREATE'), adblueController.createPurchase);
purchases.get('/:id', requirePermission('ADBLUE', 'READ'), adblueController.getPurchase);
purchases.put('/:id', requirePermission('ADBLUE', 'UPDATE'), adblueController.updatePurchase);
purchases.delete('/:id', requirePermission('ADBLUE', 'DELETE'), adblueController.deletePurchase);

const fillings = express.Router();
fillings.param('id', validateIdParam('AdBlue filling not found'));
fillings.get('/', requirePermission('ADBLUE', 'READ'), adblueController.listFillings);
fillings.post('/', requirePermission('ADBLUE', 'CREATE'), adblueController.createFilling);
fillings.get('/:id', requirePermission('ADBLUE', 'READ'), adblueController.getFilling);
fillings.put('/:id', requirePermission('ADBLUE', 'UPDATE'), adblueController.updateFilling);
fillings.delete('/:id', requirePermission('ADBLUE', 'DELETE'), adblueController.deleteFilling);

const router = express.Router();

router.use(authenticated);
router.get('/overview', requirePermission('ADBLUE', 'READ'), adblueController.overview);
router.get('/reports', requirePermission('ADBLUE', 'READ'), adblueController.reports);
router.use('/purchases', purchases);
router.use('/fillings', fillings);

module.exports = router;
