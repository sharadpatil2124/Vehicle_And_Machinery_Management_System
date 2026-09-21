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
};
