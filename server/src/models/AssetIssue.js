const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const METER_TYPES = ['KM', 'HOURS'];
const ASSET_ISSUE_STATUSES = ['issued', 'partially_reversed', 'fully_reversed'];

class AssetIssue extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      assetType: this.assetType,
      assetId: this.assetId,
      issueNumber: this.issueNumber,
      issueDateTime: this.issueDateTime,
      assetMeterReading: this.assetMeterReading == null ? null : Number(this.assetMeterReading),
      meterType: this.meterType,
      issuedToPerson: this.issuedToPerson,
      issuedByUserId: this.issuedByUserId,
      purpose: this.purpose,
      status: this.status,
      remarks: this.remarks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

AssetIssue.init(
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
    issueNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    issueDateTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    assetMeterReading: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    meterType: {
      type: DataTypes.ENUM(...METER_TYPES),
      allowNull: true,
    },
    issuedToPerson: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    issuedByUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    purpose: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...ASSET_ISSUE_STATUSES),
      allowNull: false,
      defaultValue: 'issued',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AssetIssue',
    tableName: 'asset_issues',
  }
);

AssetIssue.ASSET_TYPES = ASSET_TYPES;
AssetIssue.METER_TYPES = METER_TYPES;
AssetIssue.STATUSES = ASSET_ISSUE_STATUSES;

module.exports = AssetIssue;
