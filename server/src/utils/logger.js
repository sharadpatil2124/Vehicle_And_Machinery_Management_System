const env = require('../config/env');

/**
 * The terminal is kept deliberately quiet: the only things worth reading there
 * are the password-reset / new-Supervisor links (printed by email.service.js)
 * and the database connection status. Use this logger sparingly — for a real
 * failure or a one-off startup fact, never for tracing or debugging.
 */
const LEVELS = ['info', 'warn', 'error'];

function write(level, message, context) {
  if (env.isProduction) {
    const entry = { level, message, time: new Date().toISOString(), ...context };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    return;
  }

  const detail = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
  process.stdout.write(`[${level}] ${message}${detail}\n`);
}

const logger = {};
for (const level of LEVELS) {
  logger[level] = (message, context) => write(level, message, context);
}

module.exports = logger;
