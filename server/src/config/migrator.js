const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./database');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

function createMigrator(logger = undefined) {
  return new Umzug({
    migrations: { glob: ['*.js', { cwd: MIGRATIONS_DIR }] },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger,
  });
}

async function assertSchemaIsCurrent() {
  const migrator = createMigrator();
  const [pending, executed] = await Promise.all([migrator.pending(), migrator.executed()]);

  if (pending.length === 0 && executed.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR} — the migration glob matched nothing.`);
  }

  if (pending.length > 0) {
    const names = pending.map((migration) => migration.name).join(', ');
    throw new Error(
      `Database schema is behind: ${pending.length} pending migration(s) — ${names}. ` +
        'Run "npm run migrate" first.'
    );
  }
}

module.exports = { createMigrator, assertSchemaIsCurrent, MIGRATIONS_DIR };
