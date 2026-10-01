const express = require('express');
const issueReversalController = require('../controllers/issueReversal.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.post('/', requirePermission('ASSET_ISSUE', 'REVERSE'), issueReversalController.create);

router.get('/:id', requirePermission('ASSET_ISSUE', 'READ'), issueReversalController.get);

module.exports = router;
