const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('vehicle_documents', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    vehicle_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    doc_type: {
      type: DataTypes.ENUM('RC', 'PUC', 'INSURANCE', 'NATIONAL_PERMIT'),
      allowNull: false,
    },
    original_filename: { type: DataTypes.STRING(255), allowNull: false },
    stored_filename: { type: DataTypes.STRING(500), allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    uploaded_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('vehicle_documents', {
    type: 'unique',
    fields: ['tenant_id', 'vehicle_id', 'doc_type'],
    name: 'uq_vehicle_documents_tenant_vehicle_type',
  });

  await queryInterface.addIndex('vehicle_documents', ['tenant_id', 'vehicle_id'], {
    name: 'ix_vehicle_documents_tenant_vehicle',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('vehicle_documents');
}

module.exports = { up, down };
