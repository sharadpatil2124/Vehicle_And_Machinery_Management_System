const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('items', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    category_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'item_categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    base_uom_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    item_code: { type: DataTypes.STRING(64), allowNull: false },
    item_name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    item_type: { type: DataTypes.STRING(50), allowNull: true },
    is_hazardous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    batch_tracking_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    minimum_stock_level: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    reorder_level: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    maximum_stock_level: { type: DataTypes.DECIMAL(14, 3), allowNull: true },
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

  await queryInterface.addConstraint('items', {
    type: 'unique',
    fields: ['tenant_id', 'item_code'],
    name: 'uq_items_tenant_code',
  });

  await queryInterface.addIndex('items', ['tenant_id', 'status'], {
    name: 'ix_items_tenant_status',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('items');
}

module.exports = { up, down };
