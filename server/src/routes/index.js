const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const machineryRoutes = require('./machinery.routes');
const siteRoutes = require('./site.routes');
const complianceRoutes = require('./complianceDocument.routes');
const assetDocumentRoutes = require('./assetDocument.routes');
const { sequelize } = require('../config/database');

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/machinery', machineryRoutes);
router.use('/sites', siteRoutes);
router.use('/compliance', complianceRoutes);
router.use('/documents', assetDocumentRoutes);

module.exports = router;
