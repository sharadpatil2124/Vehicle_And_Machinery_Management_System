const express = require('express');
const itemController = require('../controllers/item.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('ITEM', 'READ'), itemController.list);

router.post('/', requirePermission('ITEM', 'CREATE'), itemController.create);

router.get('/:id', requirePermission('ITEM', 'READ'), itemController.get);

router.put('/:id', requirePermission('ITEM', 'UPDATE'), itemController.update);

router.delete('/:id', requirePermission('ITEM', 'DELETE'), itemController.remove);

router.post('/:id/restore', requirePermission('ITEM', 'RESTORE'), itemController.restore);

module.exports = router;
