const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  const userRef = {
    type: DataTypes.INTEGER.UNSIGNED,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  };

  await queryInterface.createTable('fuel_collections', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    collection_number: { type: DataTypes.STRING(64), allowNull: false },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    carrier_vehicle_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    fuel_station_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'fuel_stations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    fuel_type: { type: DataTypes.ENUM('Diesel', 'Petrol'), allowNull: false },
    collection_date: { type: DataTypes.DATEONLY, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    price_per_litre: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    bill_number: { type: DataTypes.STRING(64), allowNull: true },
    driver_name: { type: DataTypes.STRING(150), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('in_transit', 'received', 'cancelled'),
      allowNull: false,
      defaultValue: 'in_transit',
    },
    received_date: { type: DataTypes.DATEONLY, allowNull: true },
    received_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
    shortage_quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
    shortage_value: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    receipt_notes: { type: DataTypes.TEXT, allowNull: true },
    received_by: { ...userRef, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_by: { ...userRef, allowNull: true },
    created_by: { ...userRef, allowNull: false },
    updated_by: { ...userRef, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('fuel_collections', {
    type: 'unique',
    fields: ['tenant_id', 'collection_number'],
    name: 'uq_fuel_collections_tenant_number',
  });

  await queryInterface.addIndex('fuel_collections', ['tenant_id', 'site_id', 'status'], {
    name: 'ix_fuel_collections_tenant_site_status',
  });

  await queryInterface.addIndex('fuel_collections', ['tenant_id', 'collection_date'], {
    name: 'ix_fuel_collections_tenant_date',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_collections');
}

module.exports = { up, down };
