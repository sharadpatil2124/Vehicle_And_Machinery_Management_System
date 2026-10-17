const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('compliance_documents', 'document_number', {
    type: DataTypes.STRING(64),
    allowNull: true,
    after: 'road_tax_type',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('compliance_documents', 'document_number');
}

module.exports = { up, down };
