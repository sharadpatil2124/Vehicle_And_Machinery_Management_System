const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_balances', {
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
    item_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    storage_location_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    quantity_on_hand: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    reserved_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    available_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    average_unit_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    last_transaction_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('stock_balances', {
    type: 'unique',
    fields: ['tenant_id', 'site_id', 'item_id', 'storage_location_id'],
    name: 'uq_stock_balances_site_item_location',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_balances');
}

module.exports = { up, down };
