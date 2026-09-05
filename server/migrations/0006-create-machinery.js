const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('machinery', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    type: { type: DataTypes.STRING(100), allowNull: false },
    model_number: { type: DataTypes.STRING(100), allowNull: true },
    serial_number: { type: DataTypes.STRING(100), allowNull: true },
    year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true },
    fuel_type: { type: DataTypes.STRING(50), allowNull: false },
    current_hours: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    service_interval_hours: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    next_service_hours: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
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

  await queryInterface.addConstraint('machinery', {
    type: 'unique',
    fields: ['tenant_id', 'asset_id'],
    name: 'uq_machinery_tenant_asset_id',
  });

  await queryInterface.addIndex('machinery', ['tenant_id', 'status'], {
    name: 'ix_machinery_tenant_status',
  });

  await queryInterface.addIndex('machinery', ['tenant_id', 'current_site_id'], {
    name: 'ix_machinery_tenant_site',
  });

  await queryInterface.addIndex('machinery', ['tenant_id', 'created_at'], {
    name: 'ix_machinery_tenant_created',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('machinery');
}

module.exports = { up, down };
