const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('asset_issues', {
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
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    issue_number: { type: DataTypes.STRING(64), allowNull: false },
    issue_date_time: { type: DataTypes.DATE, allowNull: false },
    asset_meter_reading: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    meter_type: { type: DataTypes.ENUM('KM', 'HOURS'), allowNull: true },
    issued_to_person: { type: DataTypes.STRING(150), allowNull: true },
    issued_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    purpose: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM('issued', 'partially_reversed', 'fully_reversed'),
      allowNull: false,
      defaultValue: 'issued',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('asset_issues', {
    type: 'unique',
    fields: ['tenant_id', 'issue_number'],
    name: 'uq_asset_issues_tenant_number',
  });

  await queryInterface.addIndex('asset_issues', ['tenant_id', 'site_id'], {
    name: 'ix_asset_issues_tenant_site',
  });

  await queryInterface.addIndex('asset_issues', ['tenant_id', 'asset_type', 'asset_id'], {
    name: 'ix_asset_issues_tenant_asset',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('asset_issues');
}

module.exports = { up, down };
