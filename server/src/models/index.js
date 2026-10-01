const { sequelize } = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const AuditLog = require('./AuditLog');
const PasswordResetToken = require('./PasswordResetToken');
const Vehicle = require('./Vehicle');
const Machinery = require('./Machinery');
const Site = require('./Site');
const ComplianceDocument = require('./ComplianceDocument');
const AssetDocument = require('./AssetDocument');
const SiteAssignment = require('./SiteAssignment');
const ItemCategory = require('./ItemCategory');
const UnitOfMeasure = require('./UnitOfMeasure');
const Item = require('./Item');
const Supplier = require('./Supplier');
const StorageLocation = require('./StorageLocation');
const Purchase = require('./Purchase');
const PurchaseItem = require('./PurchaseItem');
const InventoryTransaction = require('./InventoryTransaction');
const StockBalance = require('./StockBalance');
const AssetIssue = require('./AssetIssue');
const AssetIssueItem = require('./AssetIssueItem');
const IssueReversal = require('./IssueReversal');
const IssueReversalItem = require('./IssueReversalItem');
const StockAdjustment = require('./StockAdjustment');
const StockAdjustmentItem = require('./StockAdjustmentItem');
const StockTransfer = require('./StockTransfer');
const StockTransferItem = require('./StockTransferItem');
const { ASSET_TYPES, registerAssetModel } = require('../services/asset.service');

Tenant.hasMany(User, { foreignKey: 'tenantId', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(AuditLog, { foreignKey: 'tenantId', as: 'auditLogs' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

AuditLog.belongsTo(User, { foreignKey: 'performedBy', as: 'performer' });

User.hasMany(PasswordResetToken, { foreignKey: 'userId', as: 'passwordResetTokens', onDelete: 'CASCADE' });
PasswordResetToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Tenant.hasMany(Vehicle, { foreignKey: 'tenantId', as: 'vehicles' });
Vehicle.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Vehicle.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Vehicle.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
Vehicle.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

registerAssetModel(ASSET_TYPES.VEHICLE, Vehicle);

Tenant.hasMany(Machinery, { foreignKey: 'tenantId', as: 'machinery' });
Machinery.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Machinery.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Machinery.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
Machinery.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

registerAssetModel(ASSET_TYPES.MACHINERY, Machinery);

Tenant.hasMany(Site, { foreignKey: 'tenantId', as: 'sites' });
Site.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Site.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
Site.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Site.hasMany(Vehicle, { foreignKey: 'currentSiteId', as: 'vehicles' });
Vehicle.belongsTo(Site, { foreignKey: 'currentSiteId', as: 'currentSite' });
Site.hasMany(Machinery, { foreignKey: 'currentSiteId', as: 'machinery' });
Machinery.belongsTo(Site, { foreignKey: 'currentSiteId', as: 'currentSite' });

AssetDocument.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

Tenant.hasMany(SiteAssignment, { foreignKey: 'tenantId', as: 'siteAssignments' });
SiteAssignment.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(SiteAssignment, { foreignKey: 'siteId', as: 'assignments' });
SiteAssignment.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
SiteAssignment.belongsTo(User, { foreignKey: 'assignedBy', as: 'assigner' });

Tenant.hasMany(ItemCategory, { foreignKey: 'tenantId', as: 'itemCategories' });
ItemCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
ItemCategory.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
ItemCategory.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
ItemCategory.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Tenant.hasMany(UnitOfMeasure, { foreignKey: 'tenantId', as: 'unitsOfMeasure' });
UnitOfMeasure.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
UnitOfMeasure.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
UnitOfMeasure.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
UnitOfMeasure.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Tenant.hasMany(Item, { foreignKey: 'tenantId', as: 'items' });
Item.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Item.belongsTo(ItemCategory, { foreignKey: 'categoryId', as: 'category' });
Item.belongsTo(UnitOfMeasure, { foreignKey: 'baseUomId', as: 'baseUom' });
Item.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Item.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
Item.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Tenant.hasMany(Supplier, { foreignKey: 'tenantId', as: 'suppliers' });
Supplier.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Supplier.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Supplier.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
Supplier.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Tenant.hasMany(StorageLocation, { foreignKey: 'tenantId', as: 'storageLocations' });
StorageLocation.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(StorageLocation, { foreignKey: 'siteId', as: 'storageLocations' });
StorageLocation.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
StorageLocation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
StorageLocation.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
StorageLocation.belongsTo(User, { foreignKey: 'archivedBy', as: 'archiver' });

Tenant.hasMany(Purchase, { foreignKey: 'tenantId', as: 'purchases' });
Purchase.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(Purchase, { foreignKey: 'siteId', as: 'purchases' });
Purchase.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
Purchase.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
Purchase.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Purchase.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });

Purchase.hasMany(PurchaseItem, { foreignKey: 'purchaseId', as: 'items' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId', as: 'purchase' });
PurchaseItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
PurchaseItem.belongsTo(StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });
PurchaseItem.belongsTo(UnitOfMeasure, { foreignKey: 'uomId', as: 'uom' });

Tenant.hasMany(InventoryTransaction, { foreignKey: 'tenantId', as: 'inventoryTransactions' });
InventoryTransaction.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(InventoryTransaction, { foreignKey: 'siteId', as: 'inventoryTransactions' });
InventoryTransaction.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
InventoryTransaction.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
InventoryTransaction.belongsTo(StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });
InventoryTransaction.belongsTo(UnitOfMeasure, { foreignKey: 'uomId', as: 'uom' });
InventoryTransaction.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
InventoryTransaction.belongsTo(InventoryTransaction, {
  foreignKey: 'reversedTransactionId',
  as: 'reversedTransaction',
});

Tenant.hasMany(StockBalance, { foreignKey: 'tenantId', as: 'stockBalances' });
StockBalance.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(StockBalance, { foreignKey: 'siteId', as: 'stockBalances' });
StockBalance.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
StockBalance.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
StockBalance.belongsTo(StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });

Tenant.hasMany(AssetIssue, { foreignKey: 'tenantId', as: 'assetIssues' });
AssetIssue.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(AssetIssue, { foreignKey: 'siteId', as: 'assetIssues' });
AssetIssue.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
AssetIssue.belongsTo(User, { foreignKey: 'issuedByUserId', as: 'issuedByUser' });

AssetIssue.hasMany(AssetIssueItem, { foreignKey: 'assetIssueId', as: 'items' });
AssetIssueItem.belongsTo(AssetIssue, { foreignKey: 'assetIssueId', as: 'assetIssue' });
AssetIssueItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
AssetIssueItem.belongsTo(StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });
AssetIssueItem.belongsTo(UnitOfMeasure, { foreignKey: 'uomId', as: 'uom' });
AssetIssueItem.belongsTo(InventoryTransaction, {
  foreignKey: 'inventoryTransactionId',
  as: 'inventoryTransaction',
});

AssetIssue.hasMany(IssueReversal, { foreignKey: 'assetIssueId', as: 'reversals' });
IssueReversal.belongsTo(AssetIssue, { foreignKey: 'assetIssueId', as: 'assetIssue' });
IssueReversal.belongsTo(User, { foreignKey: 'reversedBy', as: 'reverser' });

IssueReversal.hasMany(IssueReversalItem, { foreignKey: 'issueReversalId', as: 'items' });
IssueReversalItem.belongsTo(IssueReversal, { foreignKey: 'issueReversalId', as: 'issueReversal' });
IssueReversalItem.belongsTo(AssetIssueItem, { foreignKey: 'assetIssueItemId', as: 'assetIssueItem' });
IssueReversalItem.belongsTo(InventoryTransaction, {
  foreignKey: 'inventoryTransactionId',
  as: 'inventoryTransaction',
});

Tenant.hasMany(StockAdjustment, { foreignKey: 'tenantId', as: 'stockAdjustments' });
StockAdjustment.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(StockAdjustment, { foreignKey: 'siteId', as: 'stockAdjustments' });
StockAdjustment.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
StockAdjustment.belongsTo(User, { foreignKey: 'requestedBy', as: 'requester' });

StockAdjustment.hasMany(StockAdjustmentItem, { foreignKey: 'adjustmentId', as: 'items' });
StockAdjustmentItem.belongsTo(StockAdjustment, { foreignKey: 'adjustmentId', as: 'adjustment' });
StockAdjustmentItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
StockAdjustmentItem.belongsTo(StorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' });
StockAdjustmentItem.belongsTo(UnitOfMeasure, { foreignKey: 'uomId', as: 'uom' });
StockAdjustmentItem.belongsTo(InventoryTransaction, {
  foreignKey: 'inventoryTransactionId',
  as: 'inventoryTransaction',
});

Tenant.hasMany(StockTransfer, { foreignKey: 'tenantId', as: 'stockTransfers' });
StockTransfer.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Site.hasMany(StockTransfer, { foreignKey: 'fromSiteId', as: 'stockTransfersOut' });
StockTransfer.belongsTo(Site, { foreignKey: 'fromSiteId', as: 'fromSite' });
Site.hasMany(StockTransfer, { foreignKey: 'toSiteId', as: 'stockTransfersIn' });
StockTransfer.belongsTo(Site, { foreignKey: 'toSiteId', as: 'toSite' });
StockTransfer.belongsTo(User, { foreignKey: 'dispatchedBy', as: 'dispatcher' });
StockTransfer.belongsTo(User, { foreignKey: 'receivedBy', as: 'receiver' });

StockTransfer.hasMany(StockTransferItem, { foreignKey: 'stockTransferId', as: 'items' });
StockTransferItem.belongsTo(StockTransfer, { foreignKey: 'stockTransferId', as: 'stockTransfer' });
StockTransferItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
StockTransferItem.belongsTo(StorageLocation, { foreignKey: 'fromStorageLocationId', as: 'fromStorageLocation' });
StockTransferItem.belongsTo(StorageLocation, { foreignKey: 'toStorageLocationId', as: 'toStorageLocation' });
StockTransferItem.belongsTo(UnitOfMeasure, { foreignKey: 'uomId', as: 'uom' });
StockTransferItem.belongsTo(InventoryTransaction, {
  foreignKey: 'transferOutTransactionId',
  as: 'transferOutTransaction',
});
StockTransferItem.belongsTo(InventoryTransaction, {
  foreignKey: 'transferInTransactionId',
  as: 'transferInTransaction',
});

module.exports = {
  sequelize,
  Tenant,
  User,
  AuditLog,
  PasswordResetToken,
  Vehicle,
  Machinery,
  Site,
  ComplianceDocument,
  AssetDocument,
  SiteAssignment,
  ItemCategory,
  UnitOfMeasure,
  Item,
  Supplier,
  StorageLocation,
  Purchase,
  PurchaseItem,
  InventoryTransaction,
  StockBalance,
  AssetIssue,
  AssetIssueItem,
  IssueReversal,
  IssueReversalItem,
  StockAdjustment,
  StockAdjustmentItem,
  StockTransfer,
  StockTransferItem,
};
