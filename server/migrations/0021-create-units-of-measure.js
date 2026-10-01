const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('units_of_measure', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    uom_code: { type: DataTypes.STRING(64), allowNull: false },
    uom_name: { type: DataTypes.STRING(150), allowNull: false },
    conversion_factor: { type: DataTypes.DECIMAL(14, 6), allowNull: false, defaultValue: 1 },
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

  await queryInterface.addConstraint('units_of_measure', {
    type: 'unique',
    fields: ['tenant_id', 'uom_code'],
    name: 'uq_units_of_measure_tenant_code',
  });

  await queryInterface.addIndex('units_of_measure', ['tenant_id', 'status'], {
    name: 'ix_units_of_measure_tenant_status',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('units_of_measure');
}

module.exports = { up, down };
