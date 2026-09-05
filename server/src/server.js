
function fail(title, lines) {
  process.stderr.write(`\n${title}\n\n`);
  for (const line of lines) process.stderr.write(`  ${line}\n`);
  process.stderr.write('\n');
  process.exit(1);
}

let env;
try {
  env = require('./config/env');
} catch (error) {
  if (error.isConfigError) {
    fail('Cannot start — configuration problem:', [
      error.message,
      '',
      'Copy server/.env.example to server/.env and fill in the values.',
    ]);
  }
  throw error;
}

const app = require('./app');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { assertSchemaIsCurrent } = require('./config/migrator');

function describeDatabaseFailure(error) {
  const target = `${env.db.host}:${env.db.port}`;

  switch (error.original?.code ?? error.code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return [
        `MySQL rejected the credentials for user "${env.db.user}".`,
        '',
        'Set DB_USER and DB_PASSWORD in server/.env to a MySQL account that exists.',
        'Check the credentials work with:',
        `  mysql -u ${env.db.user} -p -h ${env.db.host}`,
      ];
    case 'ER_BAD_DB_ERROR':
      return [
        `The database "${env.db.name}" does not exist on ${target}.`,
        '',
        'Create it, then run the migrations:',
        `  CREATE DATABASE \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        '  npm run migrate',
      ];
    case 'ECONNREFUSED':
      return [
        `No MySQL server is accepting connections at ${target}.`,
        '',
        'Start MySQL, or correct DB_HOST and DB_PORT in server/.env.',
      ];
    default:
      return [`Could not connect to MySQL at ${target}.`, '', error.message];
  }
}

async function start() {
  try {
    await connectDatabase();
  } catch (error) {
    fail('Cannot start — database unavailable:', describeDatabaseFailure(error));
  }

  try {
    await assertSchemaIsCurrent();
  } catch (error) {
    fail('Cannot start — database schema is out of date:', [
      error.message,
      '',
      'Apply the migrations with:  npm run migrate',
    ]);
  }

  const server = app.listen(env.port, () => {
    logger.info('API listening', { port: env.port, environment: env.nodeEnv });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      fail(`Cannot start — port ${env.port} is already in use:`, [
        'Another process is using it — most likely an API instance still running.',
        '',
        'Stop it, or set a different PORT in server/.env.',
      ]);
    }
    fail('Cannot start — server error:', [error.message]);
  });

  function shutdown(signal) {
    logger.info('Shutting down', { signal });

    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
