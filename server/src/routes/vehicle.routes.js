const express = require('express');
const vehicleController = require('../controllers/vehicle.controller');
const { authenticated, requirePermission } = require('../middleware/authorize');
const { uploadAssetCreationDocuments } = require('../middleware/upload');

const router = express.Router();

router.use(authenticated);

// GET /api/vehicles
// Admin + Supervisor (Supervisor sees only vehicles at their own site).
// Query params: page, limit, sort (e.g. registrationNumber:asc),
// status (active/archived, default active), search, fuelType
router.get('/', requirePermission('VEHICLE', 'READ'), vehicleController.list);

// POST /api/vehicles
// Admin + Supervisor. multipart/form-data.
// Fields: registrationNumber, type ("Light Vehicle"/"Heavy Vehicle"), fuelType
// ("Diesel"/"Petrol"/"CNG"), modelNumber, chassisNumber, year, currentSiteId,
// currentKM, serviceIntervalKM (or currentHours, serviceIntervalHours when
// type is "Heavy Vehicle"), compliance (JSON string).
// File fields: RC, PUC, NATIONAL_PERMIT, INSURANCE
router.post(
  '/',
  requirePermission('VEHICLE', 'CREATE'),
  uploadAssetCreationDocuments,
  vehicleController.create
);

// GET /api/vehicles/:id
// Admin + Supervisor. Gets one vehicle by its numeric id.
router.get('/:id', requirePermission('VEHICLE', 'READ'), vehicleController.get);

// PUT /api/vehicles/:id
// Admin + Supervisor. Updates a vehicle. JSON body, same fields as create
// (partial allowed). A Supervisor cannot change currentSiteId to a different site.
router.put('/:id', requirePermission('VEHICLE', 'UPDATE'), vehicleController.update);

// DELETE /api/vehicles/:id
// Admin only. Archives (soft-deletes) a vehicle.
// Body: { "confirmation": "DELETE" }
router.delete('/:id', requirePermission('VEHICLE', 'DELETE'), vehicleController.remove);

// POST /api/vehicles/:id/restore
// Admin only. Restores an archived vehicle back to active.
router.post('/:id/restore', requirePermission('VEHICLE', 'RESTORE'), vehicleController.restore);

// GET /api/vehicles/:id/history
// Admin + Supervisor. Returns the audit history for this vehicle.
router.get('/:id/history', requirePermission('VEHICLE', 'READ'), vehicleController.history);

module.exports = router;
