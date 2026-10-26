const express = require('express');
const brandingController = require('../controllers/branding.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadLogo } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('BRANDING', 'READ'), brandingController.get);
router.put('/title', requirePermission('BRANDING', 'UPDATE'), brandingController.updateTitle);

router.get('/logo', requirePermission('BRANDING', 'READ'), brandingController.downloadLogo);
router.post('/logo', requirePermission('BRANDING', 'UPDATE'), uploadLogo, brandingController.uploadLogo);
router.delete('/logo', requirePermission('BRANDING', 'UPDATE'), brandingController.removeLogo);

module.exports = router;
