const { DataTypes } = require('sequelize');

/**
 * Gives every Supervisor one site.
 *
 * `site_id` is the single site a Supervisor may work with. It stays NULL for
 * Admins (they see every site in the organization), and it is nullable rather
 * than NOT NULL because supervisors already existed before this rule was added
 * and their Admin has to assign each of them a site afterwards.
 */
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
