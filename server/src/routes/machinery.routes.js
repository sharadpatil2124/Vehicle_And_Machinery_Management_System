const express = require('express');
const machineryController = require('../controllers/machinery.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadAssetCreationDocuments } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

// GET /api/machinery
// Admin + Supervisor (Supervisor sees only machines at their own site).
// Query params: page, limit, sort, status (active/archived, default active),
// search, fuelType
router.get('/', requirePermission('MACHINERY', 'READ'), machineryController.list);

// POST /api/machinery
// Admin + Supervisor. multipart/form-data.
// Fields: name, registrationNumber, type, fuelType ("Diesel"/"Petrol"/"CNG"),
// modelNumber, serialNumber, year, currentSiteId, currentHours,
// serviceIntervalHours, compliance (JSON string).
// File fields: RC, PUC, NATIONAL_PERMIT, INSURANCE
router.post(
  '/',
  requirePermission('MACHINERY', 'CREATE'),
  uploadAssetCreationDocuments,
  machineryController.create
);

// GET /api/machinery/:id
// Admin + Supervisor. Gets one machine by its numeric id.
router.get('/:id', requirePermission('MACHINERY', 'READ'), machineryController.get);

// PUT /api/machinery/:id
// Admin + Supervisor. Updates a machine. JSON body (partial allowed).
// A Supervisor cannot change currentSiteId to a different site.
router.put('/:id', requirePermission('MACHINERY', 'UPDATE'), machineryController.update);

// DELETE /api/machinery/:id
// Admin only. Archives (soft-deletes) a machine.
// Body: { "confirmation": "DELETE" }
router.delete('/:id', requirePermission('MACHINERY', 'DELETE'), machineryController.remove);

// POST /api/machinery/:id/restore
// Admin only. Restores an archived machine back to active.
router.post('/:id/restore', requirePermission('MACHINERY', 'RESTORE'), machineryController.restore);

// GET /api/machinery/:id/history
// Admin + Supervisor. Returns the audit history for this machine.
router.get('/:id/history', requirePermission('MACHINERY', 'READ'), machineryController.history);

module.exports = router;
