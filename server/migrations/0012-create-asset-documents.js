const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('asset_documents', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    doc_type: {
      type: DataTypes.ENUM('RC', 'PUC', 'NATIONAL_PERMIT', 'INSURANCE'),
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

  await queryInterface.addConstraint('asset_documents', {
    type: 'unique',
    fields: ['tenant_id', 'asset_type', 'asset_id', 'doc_type'],
    name: 'uq_asset_documents_asset_doctype',
  });

  await queryInterface.addIndex('asset_documents', ['tenant_id', 'asset_type', 'asset_id'], {
    name: 'ix_asset_documents_tenant_asset',
  });

  await queryInterface.sequelize.query(`
    INSERT INTO asset_documents
      (tenant_id, asset_type, asset_id, doc_type, original_filename, stored_filename,
       mime_type, file_size, uploaded_by, created_at, updated_at)
    SELECT vd.tenant_id, 'VEHICLE', v.asset_id, vd.doc_type, vd.original_filename, vd.stored_filename,
           vd.mime_type, vd.file_size, vd.uploaded_by, vd.created_at, vd.updated_at
    FROM vehicle_documents vd
    INNER JOIN vehicles v ON v.id = vd.vehicle_id
  `);

  await queryInterface.dropTable('vehicle_documents');
}

async function down({ context: queryInterface }) {
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

  await queryInterface.sequelize.query(`
    INSERT INTO vehicle_documents
      (tenant_id, vehicle_id, doc_type, original_filename, stored_filename,
       mime_type, file_size, uploaded_by, created_at, updated_at)
    SELECT ad.tenant_id, v.id, ad.doc_type, ad.original_filename, ad.stored_filename,
           ad.mime_type, ad.file_size, ad.uploaded_by, ad.created_at, ad.updated_at
    FROM asset_documents ad
    INNER JOIN vehicles v ON v.asset_id = ad.asset_id AND v.tenant_id = ad.tenant_id
    WHERE ad.asset_type = 'VEHICLE'
  `);

  await queryInterface.dropTable('asset_documents');
}

module.exports = { up, down };
