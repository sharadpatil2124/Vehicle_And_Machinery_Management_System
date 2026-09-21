const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const machineryRoutes = require('./machinery.routes');
const siteRoutes = require('./site.routes');
const complianceRoutes = require('./complianceDocument.routes');
const assetDocumentRoutes = require('./assetDocument.routes');
const siteAssignmentRoutes = require('./siteAssignment.routes');
const { sequelize } = require('../config/database');

const router = express.Router();

// GET /api/health
// Public. Confirms the API is up and the database connection works. Good
// first call to sanity-check Postman/the client is pointed at the right server.
router.get('/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

// See each file below for its own endpoint-by-endpoint comments.
router.use('/auth', authRoutes); // /api/auth/...
router.use('/users', userRoutes); // /api/users/...
router.use('/vehicles', vehicleRoutes); // /api/vehicles/...
router.use('/machinery', machineryRoutes); // /api/machinery/...
router.use('/sites', siteRoutes); // /api/sites/...
router.use('/compliance', complianceRoutes); // /api/compliance/...
router.use('/documents', assetDocumentRoutes); // /api/documents/...
router.use('/site-assignments', siteAssignmentRoutes); // /api/site-assignments/...

module.exports = router;
