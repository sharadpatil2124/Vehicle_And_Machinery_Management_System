const { DataTypes } = require('sequelize');

const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
};

async function up({ context: queryInterface }) {
  await queryInterface.createTable('tenants', {
    tenant_id: { type: DataTypes.STRING(64), primaryKey: true },
    organization_name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    address: { type: DataTypes.STRING(500), allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
    ...timestamps,
  });

  await queryInterface.createTable('users', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'supervisor'), allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });

  await queryInterface.addConstraint('users', {
    type: 'unique',
    fields: ['email'],
    name: 'uq_users_email',
  });

  await queryInterface.addConstraint('users', {
    type: 'unique',
    fields: ['tenant_id', 'role'],
    name: 'uq_users_tenant_role',
  });

  await queryInterface.addIndex('users', ['tenant_id', 'status'], {
    name: 'ix_users_tenant_status',
  });

  await queryInterface.createTable('audit_logs', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    entity_type: { type: DataTypes.STRING(64), allowNull: false },
    entity_id: { type: DataTypes.STRING(64), allowNull: false },
    action: { type: DataTypes.STRING(64), allowNull: false },
    before: { type: DataTypes.JSON, allowNull: true },
    after: { type: DataTypes.JSON, allowNull: true },
    performed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('audit_logs', ['tenant_id', 'entity_type', 'created_at'], {
    name: 'ix_audit_logs_tenant_entity_type',
  });

  await queryInterface.addIndex('audit_logs', ['tenant_id', 'entity_id', 'created_at'], {
    name: 'ix_audit_logs_tenant_entity_id',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('audit_logs');
  await queryInterface.dropTable('users');
  await queryInterface.dropTable('tenants');
}

module.exports = { up, down };
