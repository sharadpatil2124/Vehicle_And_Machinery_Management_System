
async function up({ context: queryInterface }) {
  const sequelize = queryInterface.sequelize;

  await queryInterface.removeConstraint('users', 'uq_users_tenant_role');

  await sequelize.query(`
    ALTER TABLE users
    ADD COLUMN admin_tenant_id VARCHAR(64)
    GENERATED ALWAYS AS (CASE WHEN role = 'admin' THEN tenant_id ELSE NULL END) VIRTUAL
  `);

  await queryInterface.addConstraint('users', {
    type: 'unique',
    fields: ['admin_tenant_id'],
    name: 'uq_users_one_admin_per_tenant',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeConstraint('users', 'uq_users_one_admin_per_tenant');
  await queryInterface.removeColumn('users', 'admin_tenant_id');
  await queryInterface.addConstraint('users', {
    type: 'unique',
    fields: ['tenant_id', 'role'],
    name: 'uq_users_tenant_role',
  });
}

module.exports = { up, down };
