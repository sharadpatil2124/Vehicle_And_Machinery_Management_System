const express = require('express');
const siteController = require('../controllers/site.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');

const router = express.Router();

router.use(authenticated);

// GET /api/sites
// Admin + Supervisor (Supervisor sees only their own assigned site).
// Query params: page, limit, sort, status (active/archived, default active), search
router.get('/', requirePermission('SITE', 'READ'), siteController.list);

// POST /api/sites
// Admin only. Creates a site. Body: { name, location }
router.post('/', requirePermission('SITE', 'CREATE'), siteController.create);

// GET /api/sites/:id
// Admin + Supervisor. Gets one site by its numeric id.
router.get('/:id', requirePermission('SITE', 'READ'), siteController.get);

// GET /api/sites/:id/assets
// Admin + Supervisor. Lists every vehicle + machine currently at this site.
router.get('/:id/assets', requirePermission('SITE', 'READ'), siteController.assets);

// PUT /api/sites/:id
// Admin only. Updates a site. Body: { name, location }
router.put('/:id', requirePermission('SITE', 'UPDATE'), siteController.update);

// DELETE /api/sites/:id
// Admin only. Archives a site. Body: { "confirmation": "DELETE" }
// Fails if a Supervisor is still assigned to this site.
router.delete('/:id', requirePermission('SITE', 'DELETE'), siteController.remove);

// POST /api/sites/:id/restore
// Admin only. Restores an archived site back to active.
router.post('/:id/restore', requirePermission('SITE', 'RESTORE'), siteController.restore);

module.exports = router;
