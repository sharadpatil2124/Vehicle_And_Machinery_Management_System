const { createMigrator } = require('../src/config/migrator');
const { sequelize, connectDatabase, disconnectDatabase } = require('../src/config/database');

const COMMANDS = ['up', 'down', 'status'];

async function run(command) {
  const migrator = createMigrator(console);

  if (command === 'status') {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);

    console.log(`\nApplied (${executed.length}):`);
    executed.forEach((migration) => console.log(`  applied  ${migration.name}`));
    if (executed.length === 0) console.log('  none');

    console.log(`\nPending (${pending.length}):`);
    pending.forEach((migration) => console.log(`  pending  ${migration.name}`));
    if (pending.length === 0) console.log('  none — schema is up to date');
    console.log('');
    return;
  }

  if (command === 'down') {
    const reverted = await migrator.down();
    if (reverted.length === 0) console.log('Nothing to roll back.');
    return;
  }

  const applied = await migrator.up();
  if (applied.length === 0) console.log('Schema is already up to date.');
}

async function main() {
  const command = process.argv[2] || 'up';

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command "${command}". Use one of: ${COMMANDS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    await connectDatabase();
    await run(command);
  } catch (error) {
    console.error(`Migration ${command} failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (sequelize) await disconnectDatabase().catch(() => {});
  }
}

main();
