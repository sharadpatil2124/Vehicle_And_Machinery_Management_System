const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const METER_TYPES = ['KM', 'HOURS'];
const REMOVAL_REASONS = ['WORN_OUT', 'PUNCTURE', 'DAMAGED', 'ROTATION', 'RETREADING', 'OTHER'];
const REMOVAL_OUTCOMES = ['in_stock', 'scrapped', 'refitted'];

class TyreAssignment extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      tyreId: this.tyreId,
      vehicleId: this.vehicleId,
      siteId: this.siteId,
      position: this.position,
      meterType: this.meterType,
      installedAt: this.installedAt,
      installMeterReading: Number(this.installMeterReading),
      installNotes: this.installNotes,
      installedBy: this.installedBy,
      removedAt: this.removedAt,
      removeMeterReading: this.removeMeterReading == null ? null : Number(this.removeMeterReading),
      removalReason: this.removalReason,
      removalOutcome: this.removalOutcome,
      removeNotes: this.removeNotes,
      removedBy: this.removedBy,
      isActive: this.removedAt == null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

TyreAssignment.init(
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
    tyreId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tyres', key: 'id' },
    },
    vehicleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
    },
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'sites', key: 'id' },
    },
    position: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    meterType: {
      type: DataTypes.ENUM(...METER_TYPES),
      allowNull: false,
    },
    installedAt: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    installMeterReading: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    installNotes: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    installedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    removedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    removeMeterReading: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    removalReason: {
      type: DataTypes.ENUM(...REMOVAL_REASONS),
      allowNull: true,
    },
    removalOutcome: {
      type: DataTypes.ENUM(...REMOVAL_OUTCOMES),
      allowNull: true,
    },
    removeNotes: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    removedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'TyreAssignment',
    tableName: 'tyre_assignments',
  }
);

TyreAssignment.METER_TYPES = METER_TYPES;
TyreAssignment.REMOVAL_REASONS = REMOVAL_REASONS;
TyreAssignment.REMOVAL_OUTCOMES = REMOVAL_OUTCOMES;

module.exports = TyreAssignment;
