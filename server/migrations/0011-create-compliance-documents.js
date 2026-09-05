const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('compliance_documents', {
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
      type: DataTypes.ENUM('ROAD_TAX', 'NATIONAL_PERMIT', 'INSURANCE', 'STATE_PERMIT', 'PUC'),
      allowNull: false,
    },
    road_tax_type: { type: DataTypes.ENUM('OTT', 'LTT', 'OTHER'), allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
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

  await queryInterface.addConstraint('compliance_documents', {
    type: 'unique',
    fields: ['tenant_id', 'asset_type', 'asset_id', 'doc_type'],
    name: 'uq_compliance_documents_asset_doctype',
  });

  await queryInterface.addIndex('compliance_documents', ['tenant_id', 'expiry_date'], {
    name: 'ix_compliance_documents_tenant_expiry',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('compliance_documents');
}

module.exports = { up, down };
