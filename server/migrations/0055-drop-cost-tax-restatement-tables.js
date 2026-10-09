async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS cost_tax_restatement_cutoffs');
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS cost_tax_restatements');
}

async function down() {
}

module.exports = { up, down };
