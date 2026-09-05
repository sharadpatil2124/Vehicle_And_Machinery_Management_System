const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeConstraint('sites', 'uq_sites_tenant_code');
  await queryInterface.removeColumn('sites', 'site_code');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('sites', 'site_code', {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
  await queryInterface.addConstraint('sites', {
    type: 'unique',
    fields: ['tenant_id', 'site_code'],
    name: 'uq_sites_tenant_code',
  });
}

module.exports = { up, down };
