const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('users', 'site_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  });

  await queryInterface.addConstraint('users', {
    type: 'foreign key',
    fields: ['site_id'],
    name: 'fk_users_site_id',
    references: { table: 'sites', field: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeConstraint('users', 'fk_users_site_id');
  await queryInterface.removeColumn('users', 'site_id');
}

module.exports = { up, down };
