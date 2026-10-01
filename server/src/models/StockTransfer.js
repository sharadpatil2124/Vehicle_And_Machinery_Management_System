const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STOCK_TRANSFER_STATUSES = ['in_transit', 'completed'];

class StockTransfer extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      fromSiteId: this.fromSiteId,
      toSiteId: this.toSiteId,
      transferNumber: this.transferNumber,
      transferDate: this.transferDate,
      dispatchedBy: this.dispatchedBy,
      receivedBy: this.receivedBy,
      receivedAt: this.receivedAt,
      status: this.status,
      remarks: this.remarks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

StockTransfer.init(
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
    fromSiteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    toSiteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    transferNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    transferDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dispatchedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    receivedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...STOCK_TRANSFER_STATUSES),
      allowNull: false,
      defaultValue: 'in_transit',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'StockTransfer',
    tableName: 'stock_transfers',
  }
);

StockTransfer.STATUSES = STOCK_TRANSFER_STATUSES;

module.exports = StockTransfer;
