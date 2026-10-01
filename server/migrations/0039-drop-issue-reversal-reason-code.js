const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeColumn('issue_reversals', 'reason_code');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('issue_reversals', 'reason_code', {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
}

module.exports = { up, down };
