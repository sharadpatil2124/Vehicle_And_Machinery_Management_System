const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StockAdjustment extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      adjustmentNumber: this.adjustmentNumber,
      adjustmentDate: this.adjustmentDate,
      reason: this.reason,
      requestedBy: this.requestedBy,
      createdAt: this.createdAt,
    };
  }
}

StockAdjustment.init(
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
    adjustmentNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    adjustmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requestedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'StockAdjustment',
    tableName: 'stock_adjustments',
    updatedAt: false,
  }
);

module.exports = StockAdjustment;
