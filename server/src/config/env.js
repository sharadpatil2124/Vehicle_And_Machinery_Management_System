require('dotenv').config();
const path = require('node:path');

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.isConfigError = true;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigError(`${name} is not set. Add it to server/.env — see .env.example.`);
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function integer(name, fallback) {
  const raw = optional(name, null);
  if (raw === null) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) {
    throw new ConfigError(`Environment variable ${name} must be an integer, received "${raw}".`);
  }
  return parsed;
}

function boolean(name, fallback) {
  const raw = optional(name, null);
  if (raw === null) return fallback;
  return raw.toLowerCase() === 'true';
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

const jwtSecret = required('JWT_SECRET');

if (isProduction && jwtSecret.length < 32) {
  throw new ConfigError('JWT_SECRET must be at least 32 characters in production.');
}

const env = {
  nodeEnv,
  isProduction,
  port: integer('PORT', 8000),
  clientUrl: optional('CLIENT_URL', 'http://localhost:5173'),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: integer('DB_PORT', 3306),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: isProduction ? required('DB_PASSWORD') : optional('DB_PASSWORD', ''),
    ssl: boolean('DB_SSL', false),
    poolMax: integer('DB_POOL_MAX', 10),
    poolMin: integer('DB_POOL_MIN', 0),
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: optional('JWT_EXPIRES_IN', '24h'),
  },

  bcryptSaltRounds: integer('BCRYPT_SALT_ROUNDS', 12),

  passwordResetTtlMinutes: integer('PASSWORD_RESET_TTL_MINUTES', 60),

  email: {
    transport: optional('EMAIL_TRANSPORT', 'console'),
    from: optional('EMAIL_FROM', 'VMMS <no-reply@vmms.local>'),
    smtp: {
      host: optional('SMTP_HOST', ''),
      port: integer('SMTP_PORT', 587),
      secure: boolean('SMTP_SECURE', false),
      user: optional('SMTP_USER', ''),
      password: optional('SMTP_PASSWORD', ''),
    },
  },

  upload: {
    dir: path.resolve(__dirname, '..', '..', optional('UPLOAD_DIR', 'storage/vehicle-documents')),
    maxFileSizeMB: integer('MAX_UPLOAD_SIZE_MB', 10),
  },
};

if (env.email.transport === 'smtp' && !env.email.smtp.host) {
  throw new ConfigError('SMTP_HOST is required when EMAIL_TRANSPORT=smtp. See .env.example.');
}

if (env.isProduction && env.email.transport === 'console') {
  throw new ConfigError('EMAIL_TRANSPORT must be "smtp" in production — reset links must not be logged.');
}

module.exports = env;
