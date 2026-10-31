const express = require('express');
const unitOfMeasureController = require('../controllers/unitOfMeasure.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam('Unit of measure not found'));

router.get('/', requirePermission('UOM', 'READ'), unitOfMeasureController.list);

router.post('/', requirePermission('UOM', 'CREATE'), unitOfMeasureController.create);

router.get('/:id', requirePermission('UOM', 'READ'), unitOfMeasureController.get);

router.put('/:id', requirePermission('UOM', 'UPDATE'), unitOfMeasureController.update);

router.delete('/:id', requirePermission('UOM', 'DELETE'), unitOfMeasureController.remove);

router.post('/:id/restore', requirePermission('UOM', 'RESTORE'), unitOfMeasureController.restore);

module.exports = router;
