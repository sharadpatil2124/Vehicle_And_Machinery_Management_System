const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('issue_reversals', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_issue_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'asset_issues', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    reversal_number: { type: DataTypes.STRING(64), allowNull: false },
    reversal_date_time: { type: DataTypes.DATE, allowNull: false },
    reason_code: { type: DataTypes.STRING(50), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    reversed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('issue_reversals', {
    type: 'unique',
    fields: ['tenant_id', 'reversal_number'],
    name: 'uq_issue_reversals_tenant_number',
  });

  await queryInterface.addIndex('issue_reversals', ['tenant_id', 'asset_issue_id'], {
    name: 'ix_issue_reversals_tenant_issue',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('issue_reversals');
}

module.exports = { up, down };
