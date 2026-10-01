const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_adjustment_items', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    adjustment_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'stock_adjustments', key: 'id' },
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
    uom_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    system_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    counted_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    adjustment_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    inventory_transaction_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('stock_adjustment_items', ['tenant_id', 'adjustment_id'], {
    name: 'ix_stock_adjustment_items_tenant_adjustment',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_adjustment_items');
}

module.exports = { up, down };
