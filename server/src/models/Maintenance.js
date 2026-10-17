const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const MAINTENANCE_TYPES = ['preventive', 'breakdown'];
const STAGES = ['reported', 'in_progress', 'resolved'];
const METER_TYPES = ['KM', 'HOURS'];
const MAINTENANCE_STATUSES = ['active', 'archived'];

const MS_PER_MINUTE = 60 * 1000;

const toNumber = (value) => (value == null ? null : Number(value));

function minutesBetween(from, to) {
  return Math.max(0, Math.floor((new Date(to) - new Date(from)) / MS_PER_MINUTE));
}

class Maintenance extends Model {
  get isOpen() {
    return this.stage !== 'resolved';
  }

  get currentDowntimeMinutes() {
    if (this.type !== 'breakdown') return null;
    if (this.stage === 'resolved' || this.status === 'archived') return this.downtimeMinutes;
    return minutesBetween(this.reportedAt, new Date());
  }

  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      assetType: this.assetType,
      assetId: this.assetId,
      type: this.type,
      stage: this.stage,
      isOpen: this.isOpen,
      reportedAt: this.reportedAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      description: this.description,
      performedBy: this.performedBy,
      labourCost: toNumber(this.labourCost),
      totalCost: toNumber(this.totalCost),
      downtimeMinutes: this.currentDowntimeMinutes,
      meterReading: toNumber(this.meterReading),
      meterType: this.meterType,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Maintenance.init(
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
      allowNull: true,
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
    type: {
      type: DataTypes.ENUM(...MAINTENANCE_TYPES),
      allowNull: false,
    },
    stage: {
      type: DataTypes.ENUM(...STAGES),
      allowNull: false,
      defaultValue: 'reported',
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    performedBy: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    labourCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    downtimeMinutes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    meterReading: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    meterType: {
      type: DataTypes.ENUM(...METER_TYPES),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...MAINTENANCE_STATUSES),
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
    modelName: 'Maintenance',
    tableName: 'maintenance',
  }
);

Maintenance.ASSET_TYPES = ASSET_TYPES;
Maintenance.TYPES = MAINTENANCE_TYPES;
Maintenance.STAGES = STAGES;
Maintenance.METER_TYPES = METER_TYPES;
Maintenance.STATUSES = MAINTENANCE_STATUSES;
Maintenance.minutesBetween = minutesBetween;

module.exports = Maintenance;
