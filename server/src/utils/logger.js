const env = require('../config/env');

const LEVELS = ['debug', 'info', 'warn', 'error'];

function write(level, message, context) {
  const entry = { level, message, time: new Date().toISOString(), ...context };

  if (env.isProduction) {
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

if (env.isProduction) {
  logger.debug = () => {};
}

module.exports = logger;
