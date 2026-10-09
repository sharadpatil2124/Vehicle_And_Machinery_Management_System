const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('site_fuel_stocks', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    fuel_type: { type: DataTypes.ENUM('Diesel', 'Petrol'), allowNull: false },
    quantity_on_hand: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    stock_value: { type: DataTypes.DECIMAL(16, 2), allowNull: false, defaultValue: 0 },
    average_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
    last_movement_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('site_fuel_stocks', {
    type: 'unique',
    fields: ['tenant_id', 'site_id', 'fuel_type'],
    name: 'uq_site_fuel_stocks_tenant_site_fuel',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('site_fuel_stocks');
}

module.exports = { up, down };
