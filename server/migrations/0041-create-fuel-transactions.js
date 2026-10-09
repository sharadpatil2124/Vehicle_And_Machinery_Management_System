const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('fuel_transactions', {
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
      allowNull: true,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    txn_date: { type: DataTypes.DATEONLY, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    price_per_litre: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    meter_reading: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    meter_type: { type: DataTypes.ENUM('KM', 'HOURS'), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    archived_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
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
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('fuel_transactions', ['tenant_id', 'asset_type', 'asset_id', 'txn_date'], {
    name: 'ix_fuel_transactions_tenant_asset_date',
  });

  await queryInterface.addIndex('fuel_transactions', ['tenant_id', 'site_id'], {
    name: 'ix_fuel_transactions_tenant_site',
  });

  await queryInterface.addIndex('fuel_transactions', ['tenant_id', 'txn_date'], {
    name: 'ix_fuel_transactions_tenant_date',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_transactions');
}

module.exports = { up, down };
