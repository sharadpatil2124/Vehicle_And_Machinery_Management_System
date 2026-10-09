const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class FuelCollectionContainer extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      containerCount: this.containerCount,
      litresPerContainer: Number(this.litresPerContainer),
    };
  }
}

FuelCollectionContainer.init(
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
    collectionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'fuel_collections', key: 'id' },
    },
    containerCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    litresPerContainer: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'FuelCollectionContainer',
    tableName: 'fuel_collection_containers',
  }
);

module.exports = FuelCollectionContainer;
