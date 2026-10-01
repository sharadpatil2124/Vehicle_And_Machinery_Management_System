const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('inventory_transactions', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
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
    item_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    storage_location_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    transaction_number: { type: DataTypes.STRING(64), allowNull: false },
    transaction_type: {
      type: DataTypes.ENUM(
        'PURCHASE_RECEIPT',
        'ISSUE',
        'ISSUE_REVERSAL',
        'ADJUSTMENT',
        'TRANSFER_OUT',
        'TRANSFER_IN'
      ),
      allowNull: false,
    },
    quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    uom_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    unit_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    reference_type: { type: DataTypes.STRING(30), allowNull: true },
    reference_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    transaction_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM('posted', 'reversed'),
      allowNull: false,
      defaultValue: 'posted',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    reversed_transaction_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
  });

  await queryInterface.addConstraint('inventory_transactions', {
    type: 'unique',
    fields: ['tenant_id', 'transaction_number'],
    name: 'uq_inventory_transactions_tenant_number',
  });

  await queryInterface.addIndex(
    'inventory_transactions',
    ['tenant_id', 'site_id', 'item_id', 'storage_location_id'],
    { name: 'ix_inventory_transactions_tenant_site_item_location' }
  );
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('inventory_transactions');
}

module.exports = { up, down };
