const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('vehicles', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    registration_number: { type: DataTypes.STRING(32), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: false },
    type: { type: DataTypes.STRING(100), allowNull: false },
    model_number: { type: DataTypes.STRING(100), allowNull: true },
    chassis_number: { type: DataTypes.STRING(100), allowNull: true },
    year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
    fuel_type: { type: DataTypes.STRING(50), allowNull: false },
    current_km: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    service_interval_km: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    next_service_km: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    current_site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
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

  await queryInterface.addConstraint('vehicles', {
    type: 'unique',
    fields: ['tenant_id', 'asset_id'],
    name: 'uq_vehicles_tenant_asset_id',
  });

  await queryInterface.addConstraint('vehicles', {
    type: 'unique',
    fields: ['tenant_id', 'registration_number'],
    name: 'uq_vehicles_tenant_registration',
  });

  await queryInterface.addIndex('vehicles', ['tenant_id', 'status'], {
    name: 'ix_vehicles_tenant_status',
  });

  await queryInterface.addIndex('vehicles', ['tenant_id', 'current_site_id'], {
    name: 'ix_vehicles_tenant_site',
  });

  await queryInterface.addIndex('vehicles', ['tenant_id', 'created_at'], {
    name: 'ix_vehicles_tenant_created',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('vehicles');
}

module.exports = { up, down };
