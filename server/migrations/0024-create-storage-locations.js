const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('storage_locations', {
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
    location_code: { type: DataTypes.STRING(64), allowNull: false },
    location_name: { type: DataTypes.STRING(150), allowNull: false },
    location_type: { type: DataTypes.STRING(50), allowNull: true },
    capacity: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    capacity_uom: { type: DataTypes.STRING(32), allowNull: true },
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

  await queryInterface.addConstraint('storage_locations', {
    type: 'unique',
    fields: ['tenant_id', 'site_id', 'location_code'],
    name: 'uq_storage_locations_site_code',
  });

  await queryInterface.addIndex('storage_locations', ['tenant_id', 'status'], {
    name: 'ix_storage_locations_tenant_status',
  });

  await queryInterface.addIndex('storage_locations', ['tenant_id', 'site_id'], {
    name: 'ix_storage_locations_tenant_site',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('storage_locations');
}

module.exports = { up, down };
