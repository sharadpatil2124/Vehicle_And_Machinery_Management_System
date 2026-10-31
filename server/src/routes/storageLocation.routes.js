const express = require('express');
const storageLocationController = require('../controllers/storageLocation.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { validateIdParam } = require('../middleware/idParam');

const router = express.Router();

router.use(authenticated);
router.param('id', validateIdParam('Storage location not found'));

router.get('/', requirePermission('STORAGE_LOCATION', 'READ'), storageLocationController.list);

router.post('/', requirePermission('STORAGE_LOCATION', 'CREATE'), storageLocationController.create);

router.get('/:id', requirePermission('STORAGE_LOCATION', 'READ'), storageLocationController.get);

router.put('/:id', requirePermission('STORAGE_LOCATION', 'UPDATE'), storageLocationController.update);

router.delete('/:id', requirePermission('STORAGE_LOCATION', 'DELETE'), storageLocationController.remove);

router.post(
  '/:id/restore',
  requirePermission('STORAGE_LOCATION', 'RESTORE'),
  storageLocationController.restore
);

module.exports = router;
