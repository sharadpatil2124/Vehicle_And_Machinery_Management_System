const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('stock_batch_movements', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    stock_batch_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'stock_batches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    inventory_transaction_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: 'inventory_transactions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    movement_type: { type: DataTypes.ENUM('RECEIVE', 'CONSUME', 'RESTORE'), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    unit_cost: { type: DataTypes.DECIMAL(14, 4), allowNull: false },
    reverses_transaction_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('stock_batch_movements', ['tenant_id', 'inventory_transaction_id'], {
    name: 'ix_stock_batch_movements_transaction',
  });

  await queryInterface.addIndex('stock_batch_movements', ['tenant_id', 'reverses_transaction_id'], {
    name: 'ix_stock_batch_movements_reverses',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('stock_batch_movements');
}

module.exports = { up, down };
