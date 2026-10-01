const env = require('../config/env');

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
