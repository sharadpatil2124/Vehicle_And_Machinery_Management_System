const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STORABLE_FUEL_TYPES = ['Diesel', 'Petrol'];

class SiteFuelStock extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      fuelType: this.fuelType,
      quantityOnHand: Number(this.quantityOnHand),
      stockValue: Number(this.stockValue),
      averageCost: Number(this.averageCost),
      lastMovementAt: this.lastMovementAt,
    };
  }
}

SiteFuelStock.init(
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
    fuelType: {
      type: DataTypes.ENUM(...STORABLE_FUEL_TYPES),
      allowNull: false,
    },
    quantityOnHand: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    stockValue: {
      type: DataTypes.DECIMAL(16, 2),
      allowNull: false,
      defaultValue: 0,
    },
    averageCost: {
      type: DataTypes.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    },
    lastMovementAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SiteFuelStock',
    tableName: 'site_fuel_stocks',
  }
);

SiteFuelStock.FUEL_TYPES = STORABLE_FUEL_TYPES;

module.exports = SiteFuelStock;
