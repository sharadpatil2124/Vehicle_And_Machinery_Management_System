const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const CONDITIONS = ['new', 'used'];
const METER_TYPES = ['KM', 'HOURS'];
const REMOVAL_REASONS = ['WORN_OUT', 'PUNCTURE', 'DAMAGED', 'OTHER'];
const REMOVAL_OUTCOMES = ['scrapped', 'returned'];

class TyreFitment extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      tyreTypeId: this.tyreTypeId,
      assetType: this.assetType,
      assetId: this.assetId,
      position: this.position,
      serialNumber: this.serialNumber,
      tyreCondition: this.tyreCondition,
      unitCost: Number(this.unitCost),
      meterType: this.meterType,
      fittedAt: this.fittedAt,
      fitMeterReading: Number(this.fitMeterReading),
      removedAt: this.removedAt,
      removeMeterReading: this.removeMeterReading == null ? null : Number(this.removeMeterReading),
      removalReason: this.removalReason,
      removalOutcome: this.removalOutcome,
      removeNotes: this.removeNotes,
      isOnAsset: this.removedAt == null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

TyreFitment.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.STRING(64), allowNull: false, references: { model: 'tenants', key: 'tenant_id' } },
    siteId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'sites', key: 'id' } },
    tyreTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'tyre_types', key: 'id' } },
    assetType: { type: DataTypes.ENUM(...ASSET_TYPES), allowNull: false },
    assetId: { type: DataTypes.STRING(64), allowNull: false },
    position: { type: DataTypes.STRING(50), allowNull: false },
    serialNumber: { type: DataTypes.STRING(64), allowNull: true },
    tyreCondition: { type: DataTypes.ENUM(...CONDITIONS), allowNull: false, defaultValue: 'new' },
    unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    meterType: { type: DataTypes.ENUM(...METER_TYPES), allowNull: false },
    fittedAt: { type: DataTypes.DATEONLY, allowNull: false },
    fitMeterReading: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    removedAt: { type: DataTypes.DATEONLY, allowNull: true },
    removeMeterReading: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    removalReason: { type: DataTypes.ENUM(...REMOVAL_REASONS), allowNull: true },
    removalOutcome: { type: DataTypes.ENUM(...REMOVAL_OUTCOMES), allowNull: true },
    removeNotes: { type: DataTypes.STRING(1000), allowNull: true },
    removedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' } },
    createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
    updatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
  },
  { sequelize, modelName: 'TyreFitment', tableName: 'tyre_fitments' }
);

TyreFitment.ASSET_TYPES = ASSET_TYPES;
TyreFitment.CONDITIONS = CONDITIONS;
TyreFitment.METER_TYPES = METER_TYPES;
TyreFitment.REMOVAL_REASONS = REMOVAL_REASONS;
TyreFitment.REMOVAL_OUTCOMES = REMOVAL_OUTCOMES;

module.exports = TyreFitment;
