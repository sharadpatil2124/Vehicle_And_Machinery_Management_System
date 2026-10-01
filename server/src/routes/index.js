const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const machineryRoutes = require('./machinery.routes');
const siteRoutes = require('./site.routes');
const complianceRoutes = require('./complianceDocument.routes');
const assetDocumentRoutes = require('./assetDocument.routes');
const siteAssignmentRoutes = require('./siteAssignment.routes');
const itemCategoryRoutes = require('./itemCategory.routes');
const unitOfMeasureRoutes = require('./unitOfMeasure.routes');
const itemRoutes = require('./item.routes');
const supplierRoutes = require('./supplier.routes');
const storageLocationRoutes = require('./storageLocation.routes');
const purchaseRoutes = require('./purchase.routes');
const stockRoutes = require('./stock.routes');
const assetIssueRoutes = require('./assetIssue.routes');
const issueReversalRoutes = require('./issueReversal.routes');
const stockAdjustmentRoutes = require('./stockAdjustment.routes');
const stockTransferRoutes = require('./stockTransfer.routes');
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
router.use('/site-assignments', siteAssignmentRoutes);

router.use('/item-categories', itemCategoryRoutes);
router.use('/units-of-measure', unitOfMeasureRoutes);
router.use('/items', itemRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/storage-locations', storageLocationRoutes);

router.use('/purchases', purchaseRoutes);
router.use('/stock', stockRoutes);

router.use('/asset-issues', assetIssueRoutes);
router.use('/issue-reversals', issueReversalRoutes);

router.use('/stock-adjustments', stockAdjustmentRoutes);
router.use('/stock-transfers', stockTransferRoutes);

module.exports = router;
