const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STORAGE_LOCATION_STATUSES = ['active', 'archived'];

class StorageLocation extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      locationCode: this.locationCode,
      locationName: this.locationName,
      locationType: this.locationType,
      capacity: this.capacity == null ? null : Number(this.capacity),
      capacityUom: this.capacityUom,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

StorageLocation.init(
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
    locationCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    locationName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    locationType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: true,
    },
    capacityUom: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...STORAGE_LOCATION_STATUSES),
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
    modelName: 'StorageLocation',
    tableName: 'storage_locations',
  }
);

StorageLocation.STATUSES = STORAGE_LOCATION_STATUSES;

module.exports = StorageLocation;
