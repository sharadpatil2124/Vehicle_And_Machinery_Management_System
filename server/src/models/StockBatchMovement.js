const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const MOVEMENT_TYPES = ['RECEIVE', 'CONSUME', 'RESTORE'];

class StockBatchMovement extends Model {}

StockBatchMovement.init(
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
    stockBatchId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'stock_batches', key: 'id' },
    },
    inventoryTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: 'inventory_transactions', key: 'id' },
    },
    movementType: {
      type: DataTypes.ENUM(...MOVEMENT_TYPES),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
    },
    reversesTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'StockBatchMovement',
    tableName: 'stock_batch_movements',
    updatedAt: false,
  }
);

StockBatchMovement.MOVEMENT_TYPES = MOVEMENT_TYPES;

module.exports = StockBatchMovement;
