const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_transfers', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    from_site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    to_site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    transfer_number: { type: DataTypes.STRING(64), allowNull: false },
    transfer_date: { type: DataTypes.DATEONLY, allowNull: false },
    dispatched_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    received_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    received_at: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('in_transit', 'completed'),
      allowNull: false,
      defaultValue: 'in_transit',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('stock_transfers', {
    type: 'unique',
    fields: ['tenant_id', 'transfer_number'],
    name: 'uq_stock_transfers_tenant_number',
  });

  await queryInterface.addIndex('stock_transfers', ['tenant_id', 'from_site_id'], {
    name: 'ix_stock_transfers_tenant_from_site',
  });

  await queryInterface.addIndex('stock_transfers', ['tenant_id', 'to_site_id'], {
    name: 'ix_stock_transfers_tenant_to_site',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_transfers');
}

module.exports = { up, down };
