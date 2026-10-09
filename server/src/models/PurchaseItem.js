const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const PURCHASE_ITEM_LINE_STATUSES = ['pending', 'received'];

class PurchaseItem extends Model {
  get unitPriceInclTax() {
    return Math.round(Number(this.unitPrice) * (1 + Number(this.taxPercentage) / 100) * 10000) / 10000;
  }

  toPublicJSON() {
    return {
      id: this.id,
      purchaseId: this.purchaseId,
      itemId: this.itemId,
      storageLocationId: this.storageLocationId,
      uomId: this.uomId,
      purchasedQuantity: Number(this.purchasedQuantity),
      receivedQuantity: Number(this.receivedQuantity),
      unitPrice: Number(this.unitPrice),
      unitPriceInclTax: this.unitPriceInclTax,
      taxPercentage: Number(this.taxPercentage),
      taxAmount: Number(this.taxAmount),
      lineTotalAmount: Number(this.lineTotalAmount),
      batchNumber: this.batchNumber,
      expiryDate: this.expiryDate,
      lineStatus: this.lineStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

PurchaseItem.init(
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
    purchaseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'purchases', key: 'id' },
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
    uomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
    },
    purchasedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    receivedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    taxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    lineTotalAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    batchNumber: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    lineStatus: {
      type: DataTypes.ENUM(...PURCHASE_ITEM_LINE_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
  },
  {
    sequelize,
    modelName: 'PurchaseItem',
    tableName: 'purchase_items',
  }
);

PurchaseItem.LINE_STATUSES = PURCHASE_ITEM_LINE_STATUSES;

module.exports = PurchaseItem;
