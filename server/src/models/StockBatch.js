const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const SOURCE_TYPES = ['OPENING_BALANCE', 'PURCHASE_RECEIPT', 'ISSUE_REVERSAL', 'ADJUSTMENT', 'TRANSFER_IN'];

class StockBatch extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      unitCost: Number(this.unitCost),
      receivedQuantity: Number(this.receivedQuantity),
      remainingQuantity: Number(this.remainingQuantity),
      receivedAt: this.receivedAt,
      sourceType: this.sourceType,
    };
  }
}

StockBatch.init(
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
    unitCost: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    receivedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    remainingQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    sourceType: {
      type: DataTypes.ENUM(...SOURCE_TYPES),
      allowNull: false,
    },
    inventoryTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'StockBatch',
    tableName: 'stock_batches',
  }
);

StockBatch.SOURCE_TYPES = SOURCE_TYPES;

module.exports = StockBatch;
