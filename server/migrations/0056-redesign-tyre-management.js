const { DataTypes } = require('sequelize');

const createTyres = require('./0053-create-tyres');
const createTyreAssignments = require('./0054-create-tyre-assignments');

const tenantRef = {
  type: DataTypes.STRING(64),
  allowNull: false,
  references: { model: 'tenants', key: 'tenant_id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
};

const userRef = (allowNull = false) => ({
  type: DataTypes.INTEGER.UNSIGNED,
  allowNull,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});

const ref = (model, allowNull = false) => ({
  type: DataTypes.INTEGER.UNSIGNED,
  allowNull,
  references: { model, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});

const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
};

async function up({ context: queryInterface }) {
  await queryInterface.dropTable('tyre_assignments');
  await queryInterface.dropTable('tyres');

  await queryInterface.createTable('tyre_types', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: tenantRef,
    type_code: { type: DataTypes.STRING(32), allowNull: false },
    brand: { type: DataTypes.STRING(100), allowNull: false },
    pattern: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    size: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
    created_by: userRef(),
    updated_by: userRef(),
    ...timestamps,
  });
  await queryInterface.addConstraint('tyre_types', { type: 'unique', fields: ['tenant_id', 'type_code'], name: 'uq_tyre_types_tenant_code' });
  await queryInterface.addConstraint('tyre_types', {
    type: 'unique',
    fields: ['tenant_id', 'brand', 'pattern', 'size'],
    name: 'uq_tyre_types_tenant_brand_pattern_size',
  });

  await queryInterface.createTable('tyre_purchases', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: tenantRef,
    purchase_number: { type: DataTypes.STRING(32), allowNull: false },
    site_id: ref('sites'),
    supplier_id: ref('suppliers', true),
    purchase_date: { type: DataTypes.DATEONLY, allowNull: false },
    bill_number: { type: DataTypes.STRING(64), allowNull: true },
    tyre_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    subtotal_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    tax_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    notes: { type: DataTypes.STRING(1000), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_by: userRef(true),
    created_by: userRef(),
    updated_by: userRef(),
    ...timestamps,
  });
  await queryInterface.addConstraint('tyre_purchases', { type: 'unique', fields: ['tenant_id', 'purchase_number'], name: 'uq_tyre_purchases_tenant_number' });
  await queryInterface.addIndex('tyre_purchases', ['tenant_id', 'site_id', 'purchase_date'], { name: 'ix_tyre_purchases_site_date' });

  await queryInterface.createTable('tyre_purchase_items', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: tenantRef,
    purchase_id: ref('tyre_purchases'),
    tyre_type_id: ref('tyre_types'),
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    tax_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    line_total: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    ...timestamps,
  });
  await queryInterface.addIndex('tyre_purchase_items', ['tenant_id', 'purchase_id'], { name: 'ix_tyre_purchase_items_purchase' });

  await queryInterface.createTable('tyre_stocks', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: tenantRef,
    site_id: ref('sites'),
    tyre_type_id: ref('tyre_types'),
    new_quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    used_quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    stock_value: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    ...timestamps,
  });
  await queryInterface.addConstraint('tyre_stocks', {
    type: 'unique',
    fields: ['tenant_id', 'site_id', 'tyre_type_id'],
    name: 'uq_tyre_stocks_site_type',
  });

  await queryInterface.createTable('tyre_fitments', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: tenantRef,
    site_id: ref('sites'),
    tyre_type_id: ref('tyre_types'),
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    position: { type: DataTypes.STRING(50), allowNull: false },
    serial_number: { type: DataTypes.STRING(64), allowNull: true },
    tyre_condition: { type: DataTypes.ENUM('new', 'used'), allowNull: false, defaultValue: 'new' },
    unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    meter_type: { type: DataTypes.ENUM('KM', 'HOURS'), allowNull: false },
    fitted_at: { type: DataTypes.DATEONLY, allowNull: false },
    fit_meter_reading: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    removed_at: { type: DataTypes.DATEONLY, allowNull: true },
    remove_meter_reading: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    removal_reason: { type: DataTypes.ENUM('WORN_OUT', 'PUNCTURE', 'DAMAGED', 'OTHER'), allowNull: true },
    removal_outcome: { type: DataTypes.ENUM('scrapped', 'returned'), allowNull: true },
    remove_notes: { type: DataTypes.STRING(1000), allowNull: true },
    removed_by: userRef(true),
    created_by: userRef(),
    updated_by: userRef(),
    ...timestamps,
  });
  await queryInterface.addIndex('tyre_fitments', ['tenant_id', 'asset_type', 'asset_id'], { name: 'ix_tyre_fitments_asset' });
  await queryInterface.addIndex('tyre_fitments', ['tenant_id', 'site_id', 'fitted_at'], { name: 'ix_tyre_fitments_site_date' });
  await queryInterface.addIndex('tyre_fitments', ['tenant_id', 'tyre_type_id'], { name: 'ix_tyre_fitments_type' });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('tyre_fitments');
  await queryInterface.dropTable('tyre_stocks');
  await queryInterface.dropTable('tyre_purchase_items');
  await queryInterface.dropTable('tyre_purchases');
  await queryInterface.dropTable('tyre_types');
  await createTyres.up({ context: queryInterface });
  await createTyreAssignments.up({ context: queryInterface });
}

module.exports = { up, down };
