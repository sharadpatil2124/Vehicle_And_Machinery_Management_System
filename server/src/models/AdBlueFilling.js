const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const STATUSES = ['active', 'archived'];

class AdBlueFilling extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      assetType: this.assetType,
      assetId: this.assetId,
      fillingDate: this.fillingDate,
      quantity: Number(this.quantity),
      ratePerLitre: Number(this.ratePerLitre),
      totalCost: Number(this.totalCost),
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

AdBlueFilling.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
    },
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    assetType: {
      type: DataTypes.ENUM(...ASSET_TYPES),
      allowNull: false,
    },
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    fillingDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    ratePerLitre: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archivedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    updatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'AdBlueFilling',
    tableName: 'adblue_fillings',
  }
);

AdBlueFilling.ASSET_TYPES = ASSET_TYPES;
AdBlueFilling.STATUSES = STATUSES;

module.exports = AdBlueFilling;
