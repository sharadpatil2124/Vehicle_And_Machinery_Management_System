const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('fuel_stock_ledger', {
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
    entry_type: {
      type: DataTypes.ENUM('RECEIPT', 'ISSUE', 'ISSUE_REVERSAL', 'ADJUSTMENT'),
      allowNull: false,
    },
    direction: { type: DataTypes.ENUM('IN', 'OUT'), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false },
    total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    balance_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    balance_value: { type: DataTypes.DECIMAL(16, 2), allowNull: false },
    entry_date: { type: DataTypes.DATEONLY, allowNull: false },
    reference_type: {
      type: DataTypes.ENUM('FUEL_COLLECTION', 'FUEL_TRANSACTION', 'FUEL_STOCK_ADJUSTMENT'),
      allowNull: false,
    },
    reference_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
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

  await queryInterface.addIndex('fuel_stock_ledger', ['tenant_id', 'site_id', 'fuel_type', 'entry_date'], {
    name: 'ix_fuel_stock_ledger_tenant_site_fuel_date',
  });

  await queryInterface.addIndex('fuel_stock_ledger', ['tenant_id', 'reference_type', 'reference_id'], {
    name: 'ix_fuel_stock_ledger_tenant_reference',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_stock_ledger');
}

module.exports = { up, down };
