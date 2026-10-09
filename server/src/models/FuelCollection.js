const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STORABLE_FUEL_TYPES = ['Diesel', 'Petrol'];
const FUEL_COLLECTION_STATUSES = ['in_transit', 'received', 'cancelled'];

const toNumber = (value) => (value == null ? null : Number(value));

class FuelCollection extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      collectionNumber: this.collectionNumber,
      siteId: this.siteId,
      carrierVehicleId: this.carrierVehicleId,
      fuelStationId: this.fuelStationId,
      fuelType: this.fuelType,
      collectionDate: this.collectionDate,
      quantity: Number(this.quantity),
      pricePerLitre: Number(this.pricePerLitre),
      amount: Number(this.amount),
      billNumber: this.billNumber,
      driverName: this.driverName,
      notes: this.notes,
      status: this.status,
      receivedDate: this.receivedDate,
      receivedQuantity: toNumber(this.receivedQuantity),
      shortageQuantity: toNumber(this.shortageQuantity),
      shortageValue: toNumber(this.shortageValue),
      receiptNotes: this.receiptNotes,
      receivedBy: this.receivedBy,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

FuelCollection.init(
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
    collectionNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    carrierVehicleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
    },
    fuelStationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'fuel_stations', key: 'id' },
    },
    fuelType: {
      type: DataTypes.ENUM(...STORABLE_FUEL_TYPES),
      allowNull: false,
    },
    collectionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    pricePerLitre: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    billNumber: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    driverName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...FUEL_COLLECTION_STATUSES),
      allowNull: false,
      defaultValue: 'in_transit',
    },
    receivedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    receivedQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
    },
    shortageQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
    },
    shortageValue: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    receiptNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    receivedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelledBy: {
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
    modelName: 'FuelCollection',
    tableName: 'fuel_collections',
  }
);

FuelCollection.FUEL_TYPES = STORABLE_FUEL_TYPES;
FuelCollection.STATUSES = FUEL_COLLECTION_STATUSES;

module.exports = FuelCollection;
