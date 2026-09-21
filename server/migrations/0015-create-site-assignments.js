const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('site_assignments', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    assigned_at: { type: DataTypes.DATE, allowNull: false },
    unassigned_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('site_assignments', ['tenant_id', 'asset_type', 'asset_id', 'assigned_at'], {
    name: 'ix_site_assignments_tenant_asset_assigned',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('site_assignments');
}

module.exports = { up, down };
