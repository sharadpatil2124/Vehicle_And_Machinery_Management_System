const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const MACHINERY_STATUSES = ['active', 'archived'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG'];

function normalizeRcpl(value) {
  return value.trim().toUpperCase();
}

function machineryLabel(machine) {
  return [machine.rcpl, machine.name].filter(Boolean).join(' · ') || machine.assetId;
}

class Machinery extends Model {
  get isServiceDue() {
    return Number(this.currentHours) >= Number(this.nextServiceHours);
  }

  toPublicJSON() {
    return {
      id: this.id,
      assetId: this.assetId,
      name: this.name,
      rcpl: this.rcpl,
      type: this.type,
      modelNumber: this.modelNumber,
      serialNumber: this.serialNumber,
      year: this.year,
      fuelType: this.fuelType,
      currentHours: Number(this.currentHours),
      serviceIntervalHours: Number(this.serviceIntervalHours),
      nextServiceHours: Number(this.nextServiceHours),
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

Machinery.init(
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
    name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    rcpl: {
      type: DataTypes.STRING(32),
      allowNull: false,
      set(value) {
        this.setDataValue('rcpl', typeof value === 'string' ? normalizeRcpl(value) : value);
      },
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    modelNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    serialNumber: {
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
    currentHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    serviceIntervalHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    nextServiceHours: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    currentSiteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'sites', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM(...MACHINERY_STATUSES),
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
    modelName: 'Machinery',
    tableName: 'machinery',
  }
);

Machinery.STATUSES = MACHINERY_STATUSES;
Machinery.FUEL_TYPES = FUEL_TYPES;
Machinery.normalizeRcpl = normalizeRcpl;
Machinery.label = machineryLabel;

module.exports = Machinery;
