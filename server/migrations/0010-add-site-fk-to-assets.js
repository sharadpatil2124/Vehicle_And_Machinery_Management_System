async function up({ context: queryInterface }) {
  await queryInterface.addConstraint('vehicles', {
    type: 'foreign key',
    fields: ['current_site_id'],
    name: 'fk_vehicles_current_site_id',
    references: { table: 'sites', field: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await queryInterface.addConstraint('machinery', {
    type: 'foreign key',
    fields: ['current_site_id'],
    name: 'fk_machinery_current_site_id',
    references: { table: 'sites', field: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeConstraint('machinery', 'fk_machinery_current_site_id');
  await queryInterface.removeConstraint('vehicles', 'fk_vehicles_current_site_id');
}

module.exports = { up, down };
