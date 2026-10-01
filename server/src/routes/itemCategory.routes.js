const express = require('express');
const itemCategoryController = require('../controllers/itemCategory.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('ITEM_CATEGORY', 'READ'), itemCategoryController.list);

router.post('/', requirePermission('ITEM_CATEGORY', 'CREATE'), itemCategoryController.create);

router.get('/:id', requirePermission('ITEM_CATEGORY', 'READ'), itemCategoryController.get);

router.put('/:id', requirePermission('ITEM_CATEGORY', 'UPDATE'), itemCategoryController.update);

router.delete('/:id', requirePermission('ITEM_CATEGORY', 'DELETE'), itemCategoryController.remove);

router.post('/:id/restore', requirePermission('ITEM_CATEGORY', 'RESTORE'), itemCategoryController.restore);

module.exports = router;
