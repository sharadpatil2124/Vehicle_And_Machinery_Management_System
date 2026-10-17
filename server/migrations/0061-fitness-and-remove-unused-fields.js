const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query("DELETE FROM compliance_documents WHERE doc_type = 'PUC'");
  await queryInterface.changeColumn('compliance_documents', 'doc_type', {
    type: DataTypes.ENUM('ROAD_TAX', 'NATIONAL_PERMIT', 'INSURANCE', 'STATE_PERMIT', 'FITNESS'),
    allowNull: false,
  });

  await queryInterface.removeColumn('purchase_items', 'batch_number');
  await queryInterface.removeColumn('purchase_items', 'expiry_date');
  await queryInterface.removeColumn('items', 'batch_tracking_required');
  await queryInterface.removeColumn('asset_issues', 'remarks');
  await queryInterface.removeColumn('storage_locations', 'location_type');
  await queryInterface.removeColumn('storage_locations', 'capacity');
  await queryInterface.removeColumn('storage_locations', 'capacity_uom');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('storage_locations', 'location_type', { type: DataTypes.STRING(50), allowNull: true, after: 'location_name' });
  await queryInterface.addColumn('storage_locations', 'capacity', { type: DataTypes.DECIMAL(14, 3), allowNull: true, after: 'location_type' });
  await queryInterface.addColumn('storage_locations', 'capacity_uom', { type: DataTypes.STRING(32), allowNull: true, after: 'capacity' });
  await queryInterface.addColumn('asset_issues', 'remarks', { type: DataTypes.TEXT, allowNull: true });
  await queryInterface.addColumn('items', 'batch_tracking_required', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, after: 'is_hazardous' });
  await queryInterface.addColumn('purchase_items', 'batch_number', { type: DataTypes.STRING(64), allowNull: true, after: 'line_total_amount' });
  await queryInterface.addColumn('purchase_items', 'expiry_date', { type: DataTypes.DATEONLY, allowNull: true, after: 'batch_number' });

  await queryInterface.sequelize.query("DELETE FROM compliance_documents WHERE doc_type = 'FITNESS'");
  await queryInterface.changeColumn('compliance_documents', 'doc_type', {
    type: DataTypes.ENUM('ROAD_TAX', 'NATIONAL_PERMIT', 'INSURANCE', 'STATE_PERMIT', 'PUC'),
    allowNull: false,
  });
}

module.exports = { up, down };
