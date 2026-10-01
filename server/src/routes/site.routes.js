const express = require('express');
const siteController = require('../controllers/site.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('SITE', 'READ'), siteController.list);

router.post('/', requirePermission('SITE', 'CREATE'), siteController.create);

router.get('/:id', requirePermission('SITE', 'READ'), siteController.get);

router.get('/:id/assets', requirePermission('SITE', 'READ'), siteController.assets);

router.put('/:id', requirePermission('SITE', 'UPDATE'), siteController.update);

router.delete('/:id', requirePermission('SITE', 'DELETE'), siteController.remove);

router.post('/:id/restore', requirePermission('SITE', 'RESTORE'), siteController.restore);

module.exports = router;
