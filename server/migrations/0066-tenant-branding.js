const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('tenants', 'dashboard_title', {
    type: DataTypes.STRING(150),
    allowNull: true,
    after: 'address',
  });
  await queryInterface.addColumn('tenants', 'logo_stored_filename', {
    type: DataTypes.STRING(255),
    allowNull: true,
    after: 'dashboard_title',
  });
  await queryInterface.addColumn('tenants', 'logo_mime_type', {
    type: DataTypes.STRING(50),
    allowNull: true,
    after: 'logo_stored_filename',
  });
  await queryInterface.addColumn('tenants', 'logo_updated_at', {
    type: DataTypes.DATE,
    allowNull: true,
    after: 'logo_mime_type',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('tenants', 'logo_updated_at');
  await queryInterface.removeColumn('tenants', 'logo_mime_type');
  await queryInterface.removeColumn('tenants', 'logo_stored_filename');
  await queryInterface.removeColumn('tenants', 'dashboard_title');
}

module.exports = { up, down };
