const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_adjustments', {
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
    adjustment_number: { type: DataTypes.STRING(64), allowNull: false },
    adjustment_date: { type: DataTypes.DATEONLY, allowNull: false },
    reason_code: { type: DataTypes.STRING(50), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    requested_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('stock_adjustments', {
    type: 'unique',
    fields: ['tenant_id', 'adjustment_number'],
    name: 'uq_stock_adjustments_tenant_number',
  });

  await queryInterface.addIndex('stock_adjustments', ['tenant_id', 'site_id'], {
    name: 'ix_stock_adjustments_tenant_site',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_adjustments');
}

module.exports = { up, down };
