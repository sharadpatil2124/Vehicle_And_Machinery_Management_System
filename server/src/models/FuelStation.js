const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const FUEL_STATION_STATUSES = ['active', 'archived'];

class FuelStation extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      stationCode: this.stationCode,
      stationName: this.stationName,
      location: this.location,
      phone: this.phone,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

FuelStation.init(
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
    stationCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    stationName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...FUEL_STATION_STATUSES),
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
    modelName: 'FuelStation',
    tableName: 'fuel_stations',
  }
);

FuelStation.STATUSES = FUEL_STATION_STATUSES;

module.exports = FuelStation;
