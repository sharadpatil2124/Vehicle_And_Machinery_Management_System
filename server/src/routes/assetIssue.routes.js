const express = require('express');
const assetIssueController = require('../controllers/assetIssue.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

router.get('/', requirePermission('ASSET_ISSUE', 'READ'), assetIssueController.list);

router.post('/', requirePermission('ASSET_ISSUE', 'CREATE'), assetIssueController.create);

router.get('/:id', requirePermission('ASSET_ISSUE', 'READ'), assetIssueController.get);

module.exports = router;
