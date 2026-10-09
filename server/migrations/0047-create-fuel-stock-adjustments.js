const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('fuel_stock_adjustments', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    adjustment_number: { type: DataTypes.STRING(64), allowNull: false },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    fuel_type: { type: DataTypes.ENUM('Diesel', 'Petrol'), allowNull: false },
    adjustment_date: { type: DataTypes.DATEONLY, allowNull: false },
    system_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    counted_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    difference_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
    value_change: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    reason: { type: DataTypes.TEXT, allowNull: false },
    ledger_entry_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'fuel_stock_ledger', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('fuel_stock_adjustments', {
    type: 'unique',
    fields: ['tenant_id', 'adjustment_number'],
    name: 'uq_fuel_stock_adjustments_tenant_number',
  });

  await queryInterface.addIndex('fuel_stock_adjustments', ['tenant_id', 'site_id'], {
    name: 'ix_fuel_stock_adjustments_tenant_site',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_stock_adjustments');
}

module.exports = { up, down };
