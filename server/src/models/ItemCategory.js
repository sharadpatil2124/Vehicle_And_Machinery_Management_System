const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const ITEM_CATEGORY_STATUSES = ['active', 'archived'];

class ItemCategory extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      categoryCode: this.categoryCode,
      categoryName: this.categoryName,
      inventoryType: this.inventoryType,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

ItemCategory.init(
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
    categoryCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    categoryName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    inventoryType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...ITEM_CATEGORY_STATUSES),
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
    modelName: 'ItemCategory',
    tableName: 'item_categories',
  }
);

ItemCategory.STATUSES = ITEM_CATEGORY_STATUSES;

module.exports = ItemCategory;
