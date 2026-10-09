const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('fuel_stations', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    station_code: { type: DataTypes.STRING(64), allowNull: false },
    station_name: { type: DataTypes.STRING(255), allowNull: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(30), allowNull: true },
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

  await queryInterface.addConstraint('fuel_stations', {
    type: 'unique',
    fields: ['tenant_id', 'station_code'],
    name: 'uq_fuel_stations_tenant_code',
  });

  await queryInterface.addIndex('fuel_stations', ['tenant_id', 'status'], {
    name: 'ix_fuel_stations_tenant_status',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_stations');
}

module.exports = { up, down };
