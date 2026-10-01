const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const TRANSACTION_TYPES = [
  'PURCHASE_RECEIPT',
  'ISSUE',
  'ISSUE_REVERSAL',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
];
const TRANSACTION_STATUSES = ['posted', 'reversed'];

class InventoryTransaction extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      itemId: this.itemId,
      storageLocationId: this.storageLocationId,
      transactionNumber: this.transactionNumber,
      transactionType: this.transactionType,
      quantity: Number(this.quantity),
      uomId: this.uomId,
      unitCost: Number(this.unitCost),
      totalCost: Number(this.totalCost),
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      transactionAt: this.transactionAt,
      status: this.status,
      remarks: this.remarks,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      reversedTransactionId: this.reversedTransactionId,
    };
  }
}

InventoryTransaction.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
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
    itemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
    },
    storageLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
    },
    transactionNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    transactionType: {
      type: DataTypes.ENUM(...TRANSACTION_TYPES),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    uomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
    },
    unitCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    referenceType: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    referenceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    transactionAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...TRANSACTION_STATUSES),
      allowNull: false,
      defaultValue: 'posted',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    reversedTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'InventoryTransaction',
    tableName: 'inventory_transactions',
    updatedAt: false,
  }
);

InventoryTransaction.TYPES = TRANSACTION_TYPES;
InventoryTransaction.STATUSES = TRANSACTION_STATUSES;

module.exports = InventoryTransaction;
