const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StockTransferItem extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      stockTransferId: this.stockTransferId,
      itemId: this.itemId,
      fromStorageLocationId: this.fromStorageLocationId,
      toStorageLocationId: this.toStorageLocationId,
      uomId: this.uomId,
      quantity: Number(this.quantity),
      unitCost: Number(this.unitCost),
      totalCost: Number(this.totalCost),
      transferOutTransactionId: this.transferOutTransactionId,
      transferInTransactionId: this.transferInTransactionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

StockTransferItem.init(
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
    stockTransferId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'stock_transfers', key: 'id' },
    },
    itemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
    },
    fromStorageLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
    },
    toStorageLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
    },
    uomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
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
    transferOutTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
    transferInTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'StockTransferItem',
    tableName: 'stock_transfer_items',
  }
);

module.exports = StockTransferItem;
