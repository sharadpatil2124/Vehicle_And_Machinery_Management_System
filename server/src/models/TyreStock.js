const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class TyreStock extends Model {
  get averageCost() {
    const quantity = Number(this.newQuantity);
    return quantity > 0 ? Math.round((Number(this.stockValue) / quantity) * 100) / 100 : 0;
  }

  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      tyreTypeId: this.tyreTypeId,
      newQuantity: Number(this.newQuantity),
      usedQuantity: Number(this.usedQuantity),
      stockValue: Number(this.stockValue),
      averageCost: this.averageCost,
      updatedAt: this.updatedAt,
    };
  }
}

TyreStock.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.STRING(64), allowNull: false, references: { model: 'tenants', key: 'tenant_id' } },
    siteId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'sites', key: 'id' } },
    tyreTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'tyre_types', key: 'id' } },
    newQuantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    usedQuantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    stockValue: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'TyreStock', tableName: 'tyre_stocks' }
);

module.exports = TyreStock;
