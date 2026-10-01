const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('../utils/logger');

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: env.db.poolMax,
    min: env.db.poolMin,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
});

async function connectDatabase() {
  await sequelize.authenticate();
  logger.info('Database connected', {
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
  });
}

async function disconnectDatabase() {
  await sequelize.close();
}

module.exports = { sequelize, connectDatabase, disconnectDatabase };
