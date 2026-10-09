const { DataTypes } = require('sequelize');

const userRef = {
  type: DataTypes.INTEGER.UNSIGNED,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
};

async function up({ context: queryInterface }) {
  await queryInterface.createTable('tyre_assignments', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    tyre_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tyres', key: 'id' },
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
    },
    vehicle_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    position: { type: DataTypes.STRING(16), allowNull: false },
    meter_type: { type: DataTypes.ENUM('KM', 'HOURS'), allowNull: false },
    installed_at: { type: DataTypes.DATEONLY, allowNull: false },
    install_meter_reading: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    install_notes: { type: DataTypes.STRING(1000), allowNull: true },
    installed_by: { ...userRef, allowNull: false },
    removed_at: { type: DataTypes.DATEONLY, allowNull: true },
    remove_meter_reading: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    removal_reason: {
      type: DataTypes.ENUM('WORN_OUT', 'PUNCTURE', 'DAMAGED', 'ROTATION', 'RETREADING', 'OTHER'),
      allowNull: true,
    },
    removal_outcome: { type: DataTypes.ENUM('in_stock', 'scrapped', 'refitted'), allowNull: true },
    remove_notes: { type: DataTypes.STRING(1000), allowNull: true },
    removed_by: { ...userRef, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.sequelize.query(
    'ALTER TABLE tyre_assignments ' +
      'ADD COLUMN active_position VARCHAR(16) GENERATED ALWAYS AS (IF(removed_at IS NULL, position, NULL)) STORED, ' +
      'ADD COLUMN active_tyre_id INT UNSIGNED GENERATED ALWAYS AS (IF(removed_at IS NULL, tyre_id, NULL)) STORED'
  );

  await queryInterface.addConstraint('tyre_assignments', {
    type: 'unique',
    fields: ['tenant_id', 'vehicle_id', 'active_position'],
    name: 'uq_tyre_assignments_active_position',
  });

  await queryInterface.addConstraint('tyre_assignments', {
    type: 'unique',
    fields: ['tenant_id', 'active_tyre_id'],
    name: 'uq_tyre_assignments_active_tyre',
  });

  await queryInterface.addIndex('tyre_assignments', ['tenant_id', 'vehicle_id', 'position', 'installed_at'], {
    name: 'ix_tyre_assignments_vehicle_position',
  });
  await queryInterface.addIndex('tyre_assignments', ['tenant_id', 'tyre_id'], { name: 'ix_tyre_assignments_tyre' });
  await queryInterface.addIndex('tyre_assignments', ['tenant_id', 'site_id', 'installed_at'], {
    name: 'ix_tyre_assignments_site',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('tyre_assignments');
}

module.exports = { up, down };
