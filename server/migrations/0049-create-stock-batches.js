const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_batches', {
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
    unit_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
    received_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    remaining_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    received_at: { type: DataTypes.DATE, allowNull: false },
    source_type: {
      type: DataTypes.ENUM('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'ISSUE_REVERSAL', 'ADJUSTMENT', 'TRANSFER_IN'),
      allowNull: false,
    },
    inventory_transaction_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex(
    'stock_batches',
    ['tenant_id', 'site_id', 'item_id', 'storage_location_id', 'received_at', 'id'],
    { name: 'ix_stock_batches_balance_age' }
  );

  await queryInterface.sequelize.query(`
    INSERT INTO stock_batches
      (tenant_id, site_id, item_id, storage_location_id, unit_cost, received_quantity, remaining_quantity,
       received_at, source_type, inventory_transaction_id, created_at, updated_at)
    SELECT tenant_id, site_id, item_id, storage_location_id, average_unit_cost, quantity_on_hand, quantity_on_hand,
           COALESCE(last_transaction_at, updated_at), 'OPENING_BALANCE', NULL, NOW(), NOW()
      FROM stock_balances
     WHERE quantity_on_hand > 0
  `);
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_batches');
}

module.exports = { up, down };
