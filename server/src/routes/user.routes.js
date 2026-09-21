const express = require('express');
const userController = require('../controllers/user.controller');
const { adminOnly, requirePermission } = require('../middleware/authorize');

const router = express.Router();

// Every route below is Admin only.
router.use(adminOnly);

// GET /api/users
// Admin only. Lists every user (Admin + Supervisors) in the organization.
router.get('/', requirePermission('USERS', 'LIST'), userController.list);

// POST /api/users/supervisors
// Admin only. Creates a new Supervisor. Body: { name, email, siteId }
// siteId is required and must be an existing site in the same organization.
router.post(
  '/supervisors',
  requirePermission('USERS', 'CREATE_SUPERVISOR'),
  userController.createSupervisor
);

// PUT /api/users/supervisors/:id
// Admin only. Updates a Supervisor's name/email/assigned site.
// Body: { name, email, siteId }
router.put(
  '/supervisors/:id',
  requirePermission('USERS', 'UPDATE_SUPERVISOR'),
  userController.updateSupervisor
);

// PATCH /api/users/supervisors/:id/status
// Admin only. Activates/deactivates a Supervisor.
// Body: { status: "active" } or { status: "inactive" }
router.patch(
  '/supervisors/:id/status',
  requirePermission('USERS', 'SET_SUPERVISOR_STATUS'),
  userController.setSupervisorStatus
);

module.exports = router;
