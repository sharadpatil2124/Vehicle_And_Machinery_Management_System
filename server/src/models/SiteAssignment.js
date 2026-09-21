const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];

class SiteAssignment extends Model {
  get isActive() {
    return this.unassignedAt === null;
  }

  toPublicJSON() {
    return {
      id: this.id,
      assetType: this.assetType,
      assetId: this.assetId,
      siteId: this.siteId,
      siteName: this.site ? this.site.name : undefined,
      assignedAt: this.assignedAt,
      unassignedAt: this.unassignedAt,
      active: this.isActive,
      assignedBy: this.assignedBy,
      assignedByName: this.assigner ? this.assigner.name : undefined,
    };
  }
}

SiteAssignment.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
    },
    assetType: {
      type: DataTypes.ENUM(...ASSET_TYPES),
      allowNull: false,
    },
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    unassignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    assignedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'SiteAssignment',
    tableName: 'site_assignments',
  }
);

SiteAssignment.ASSET_TYPES = ASSET_TYPES;

module.exports = SiteAssignment;
