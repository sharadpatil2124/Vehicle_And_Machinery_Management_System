const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const VEHICLE_STATUSES = ['active', 'archived'];
const VEHICLE_TYPES = ['Light Vehicle', 'Heavy Vehicle'];
const HOURS_BASED_VEHICLE_TYPE = 'Heavy Vehicle';
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG'];

class Vehicle extends Model {
  get isHoursBased() {
    return this.type === HOURS_BASED_VEHICLE_TYPE;
  }

  get isServiceDue() {
    const current = this.isHoursBased ? this.currentHours : this.currentKM;
    const next = this.isHoursBased ? this.nextServiceHours : this.nextServiceKM;
    if (current == null || next == null) return false;
    return Number(current) >= Number(next);
  }

  toPublicJSON() {
    return {
      id: this.id,
      assetId: this.assetId,
      registrationNumber: this.registrationNumber,
      type: this.type,
      modelNumber: this.modelNumber,
      chassisNumber: this.chassisNumber,
      year: this.year,
      fuelType: this.fuelType,
      isHoursBased: this.isHoursBased,
      currentKM: this.currentKM == null ? null : Number(this.currentKM),
      serviceIntervalKM: this.serviceIntervalKM == null ? null : Number(this.serviceIntervalKM),
      nextServiceKM: this.nextServiceKM == null ? null : Number(this.nextServiceKM),
      currentHours: this.currentHours == null ? null : Number(this.currentHours),
      serviceIntervalHours:
        this.serviceIntervalHours == null ? null : Number(this.serviceIntervalHours),
      nextServiceHours: this.nextServiceHours == null ? null : Number(this.nextServiceHours),
      isServiceDue: this.isServiceDue,
      currentSiteId: this.currentSiteId,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Vehicle.init(
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
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    registrationNumber: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    modelNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    chassisNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    year: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
    },
    fuelType: {
      type: DataTypes.ENUM(...FUEL_TYPES),
      allowNull: false,
    },
    currentKM: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'current_km',
    },
    serviceIntervalKM: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'service_interval_km',
    },
    nextServiceKM: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'next_service_km',
    },
    currentHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    serviceIntervalHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    nextServiceHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    currentSiteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'sites', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM(...VEHICLE_STATUSES),
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
    modelName: 'Vehicle',
    tableName: 'vehicles',
  }
);

Vehicle.STATUSES = VEHICLE_STATUSES;
Vehicle.TYPES = VEHICLE_TYPES;
Vehicle.HOURS_BASED_TYPE = HOURS_BASED_VEHICLE_TYPE;
Vehicle.FUEL_TYPES = FUEL_TYPES;

module.exports = Vehicle;
