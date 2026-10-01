const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ITEM_STATUSES = ['active', 'archived'];

class Item extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      categoryId: this.categoryId,
      baseUomId: this.baseUomId,
      itemCode: this.itemCode,
      itemName: this.itemName,
      description: this.description,
      itemType: this.itemType,
      isHazardous: this.isHazardous,
      batchTrackingRequired: this.batchTrackingRequired,
      minimumStockLevel: this.minimumStockLevel == null ? null : Number(this.minimumStockLevel),
      reorderLevel: this.reorderLevel == null ? null : Number(this.reorderLevel),
      maximumStockLevel: this.maximumStockLevel == null ? null : Number(this.maximumStockLevel),
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Item.init(
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
    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'item_categories', key: 'id' },
    },
    baseUomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
    },
    itemCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    itemType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    isHazardous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    batchTrackingRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    minimumStockLevel: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: true,
    },
    reorderLevel: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: true,
    },
    maximumStockLevel: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...ITEM_STATUSES),
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
    modelName: 'Item',
    tableName: 'items',
  }
);

Item.STATUSES = ITEM_STATUSES;

module.exports = Item;
