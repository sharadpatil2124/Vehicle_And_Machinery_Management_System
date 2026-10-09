const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const METER_TYPES = ['KM', 'HOURS'];
const FUEL_TRANSACTION_STATUSES = ['active', 'archived'];
const SOURCES = ['SITE_STOCK', 'DIRECT_PUMP'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG'];

class FuelTransaction extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      source: this.source,
      fuelType: this.fuelType,
      fuelStationId: this.fuelStationId,
      ledgerEntryId: this.ledgerEntryId,
      reversalLedgerEntryId: this.reversalLedgerEntryId,
      assetType: this.assetType,
      assetId: this.assetId,
      txnDate: this.txnDate,
      quantity: Number(this.quantity),
      pricePerLitre: Number(this.pricePerLitre),
      amount: Number(this.amount),
      meterReading: Number(this.meterReading),
      meterType: this.meterType,
      notes: this.notes,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

FuelTransaction.init(
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
    source: {
      type: DataTypes.ENUM(...SOURCES),
      allowNull: false,
      defaultValue: 'DIRECT_PUMP',
    },
    fuelType: {
      type: DataTypes.ENUM(...FUEL_TYPES),
      allowNull: true,
    },
    fuelStationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'fuel_stations', key: 'id' },
    },
    ledgerEntryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'fuel_stock_ledger', key: 'id' },
    },
    reversalLedgerEntryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'fuel_stock_ledger', key: 'id' },
    },
    assetType: {
      type: DataTypes.ENUM(...ASSET_TYPES),
      allowNull: false,
    },
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    txnDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    pricePerLitre: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    meterReading: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    meterType: {
      type: DataTypes.ENUM(...METER_TYPES),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...FUEL_TRANSACTION_STATUSES),
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
    modelName: 'FuelTransaction',
    tableName: 'fuel_transactions',
  }
);

FuelTransaction.ASSET_TYPES = ASSET_TYPES;
FuelTransaction.METER_TYPES = METER_TYPES;
FuelTransaction.STATUSES = FUEL_TRANSACTION_STATUSES;
FuelTransaction.SOURCES = SOURCES;
FuelTransaction.FUEL_TYPES = FUEL_TYPES;

module.exports = FuelTransaction;
