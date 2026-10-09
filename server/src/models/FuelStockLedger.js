const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STORABLE_FUEL_TYPES = ['Diesel', 'Petrol'];
const ENTRY_TYPES = ['RECEIPT', 'ISSUE', 'ISSUE_REVERSAL'];
const DIRECTIONS = ['IN', 'OUT'];
const REFERENCE_TYPES = ['FUEL_COLLECTION', 'FUEL_TRANSACTION'];

class FuelStockLedger extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      fuelType: this.fuelType,
      entryType: this.entryType,
      direction: this.direction,
      quantity: Number(this.quantity),
      unitCost: Number(this.unitCost),
      totalCost: Number(this.totalCost),
      balanceQuantity: Number(this.balanceQuantity),
      balanceValue: Number(this.balanceValue),
      entryDate: this.entryDate,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }
}

FuelStockLedger.init(
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
    fuelType: {
      type: DataTypes.ENUM(...STORABLE_FUEL_TYPES),
      allowNull: false,
    },
    entryType: {
      type: DataTypes.ENUM(...ENTRY_TYPES),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM(...DIRECTIONS),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    balanceQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    balanceValue: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
    },
    entryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    referenceType: {
      type: DataTypes.ENUM(...REFERENCE_TYPES),
      allowNull: false,
    },
    referenceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'FuelStockLedger',
    tableName: 'fuel_stock_ledger',
  }
);

FuelStockLedger.FUEL_TYPES = STORABLE_FUEL_TYPES;
FuelStockLedger.ENTRY_TYPES = ENTRY_TYPES;
FuelStockLedger.REFERENCE_TYPES = REFERENCE_TYPES;

module.exports = FuelStockLedger;
