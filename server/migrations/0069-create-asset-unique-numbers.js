const CHASSIS_TAKEN = 'This chassis number is already in use by another asset';
const REGISTRATION_TAKEN = 'This registration number is already in use by another asset';

const isPresent = (column) => `${column} IS NOT NULL AND ${column} <> ''`;

const claimNumber = (numberType, column, message) => `
      IF ${isPresent(`NEW.${column}`)} THEN
        BEGIN
          DECLARE EXIT HANDLER FOR 1062 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${message}';
          INSERT INTO asset_unique_numbers (number_type, number_value) VALUES ('${numberType}', NEW.${column});
        END;
      END IF;`;

const releaseNumber = (numberType, column) => `
      IF ${isPresent(`OLD.${column}`)} THEN
        DELETE FROM asset_unique_numbers WHERE number_type = '${numberType}' AND number_value = OLD.${column};
      END IF;`;

const swapNumber = (numberType, column, message) => `
      IF NOT (NEW.${column} <=> OLD.${column}) THEN${claimNumber(numberType, column, message)}${releaseNumber(numberType, column)}
      END IF;`;

const TRIGGERS = [
  {
    name: 'trg_vehicles_unique_identifiers_ins',
    timing: 'BEFORE INSERT',
    table: 'vehicles',
    body: claimNumber('CHASSIS', 'chassis_number', CHASSIS_TAKEN) + claimNumber('REGISTRATION', 'registration_number', REGISTRATION_TAKEN),
  },
  {
    name: 'trg_vehicles_unique_identifiers_upd',
    timing: 'BEFORE UPDATE',
    table: 'vehicles',
    body: swapNumber('CHASSIS', 'chassis_number', CHASSIS_TAKEN) + swapNumber('REGISTRATION', 'registration_number', REGISTRATION_TAKEN),
  },
  {
    name: 'trg_vehicles_unique_identifiers_del',
    timing: 'AFTER DELETE',
    table: 'vehicles',
    body: releaseNumber('CHASSIS', 'chassis_number') + releaseNumber('REGISTRATION', 'registration_number'),
  },
  {
    name: 'trg_machinery_unique_identifiers_ins',
    timing: 'BEFORE INSERT',
    table: 'machinery',
    body: claimNumber('CHASSIS', 'serial_number', CHASSIS_TAKEN),
  },
  {
    name: 'trg_machinery_unique_identifiers_upd',
    timing: 'BEFORE UPDATE',
    table: 'machinery',
    body: swapNumber('CHASSIS', 'serial_number', CHASSIS_TAKEN),
  },
  {
    name: 'trg_machinery_unique_identifiers_del',
    timing: 'AFTER DELETE',
    table: 'machinery',
    body: releaseNumber('CHASSIS', 'serial_number'),
  },
];

// The read-only checks from 0063, restored by down().
const readOnlyChassisCheck = (self, selfColumn, other, otherColumn, excludeSelf) => `
      IF ${isPresent(`NEW.${selfColumn}`)} THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM ${self} WHERE ${selfColumn} = NEW.${selfColumn}${excludeSelf ? ' AND id <> NEW.id' : ''}
          UNION ALL
          SELECT id FROM ${other} WHERE ${otherColumn} = NEW.${selfColumn}
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${CHASSIS_TAKEN}';
        END IF;
      END IF;`;

const readOnlyRegistrationCheck = (excludeSelf) => `
      IF ${isPresent('NEW.registration_number')} THEN
        SELECT COUNT(*) INTO dup_count FROM vehicles
         WHERE registration_number = NEW.registration_number${excludeSelf ? ' AND id <> NEW.id' : ''};
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${REGISTRATION_TAKEN}';
        END IF;
      END IF;`;

const READ_ONLY_TRIGGERS = [
  {
    name: 'trg_vehicles_unique_identifiers_ins',
    timing: 'BEFORE INSERT',
    table: 'vehicles',
    body: `DECLARE dup_count INT;${readOnlyChassisCheck('vehicles', 'chassis_number', 'machinery', 'serial_number', false)}${readOnlyRegistrationCheck(false)}`,
  },
  {
    name: 'trg_vehicles_unique_identifiers_upd',
    timing: 'BEFORE UPDATE',
    table: 'vehicles',
    body: `DECLARE dup_count INT;${readOnlyChassisCheck('vehicles', 'chassis_number', 'machinery', 'serial_number', true)}${readOnlyRegistrationCheck(true)}`,
  },
  {
    name: 'trg_machinery_unique_identifiers_ins',
    timing: 'BEFORE INSERT',
    table: 'machinery',
    body: `DECLARE dup_count INT;${readOnlyChassisCheck('machinery', 'serial_number', 'vehicles', 'chassis_number', false)}`,
  },
  {
    name: 'trg_machinery_unique_identifiers_upd',
    timing: 'BEFORE UPDATE',
    table: 'machinery',
    body: `DECLARE dup_count INT;${readOnlyChassisCheck('machinery', 'serial_number', 'vehicles', 'chassis_number', true)}`,
  },
];

async function createTriggers(sequelize, triggers) {
  for (const trigger of triggers) {
    await sequelize.query(`
      CREATE TRIGGER ${trigger.name}
      ${trigger.timing} ON ${trigger.table}
      FOR EACH ROW
      BEGIN
        ${trigger.body}
      END
    `);
  }
}

async function dropTriggers(sequelize, triggers) {
  for (const trigger of triggers) await sequelize.query(`DROP TRIGGER IF EXISTS ${trigger.name}`);
}

async function findDuplicates(sequelize) {
  const [rows] = await sequelize.query(`
    SELECT 'chassis' AS kind, number_value AS value, COUNT(*) AS uses FROM (
      SELECT chassis_number AS number_value FROM vehicles WHERE ${isPresent('chassis_number')}
      UNION ALL
      SELECT serial_number FROM machinery WHERE ${isPresent('serial_number')}
    ) AS chassis GROUP BY number_value HAVING COUNT(*) > 1
    UNION ALL
    SELECT 'registration', registration_number, COUNT(*) FROM vehicles
    WHERE ${isPresent('registration_number')} GROUP BY registration_number HAVING COUNT(*) > 1
  `);
  return rows;
}

async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  // Sequelize's createTable is CREATE TABLE IF NOT EXISTS, so a stray table must be refused, not built on.
  if (await queryInterface.tableExists('asset_unique_numbers')) {
    throw new Error('Table asset_unique_numbers already exists: remove or rename it, then run the migration again');
  }

  const duplicates = await findDuplicates(sequelize);
  if (duplicates.length > 0) {
    const list = duplicates.map((d) => `${d.kind} "${d.value}" (${d.uses} assets)`).join(', ');
    throw new Error(`Cannot enforce unique asset numbers, these are used more than once. Fix them first: ${list}`);
  }

  const [[{ collation }]] = await sequelize.query(
    `SELECT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles'`
  );

  await sequelize.query(`
    CREATE TABLE asset_unique_numbers (
      number_type ENUM('REGISTRATION', 'CHASSIS') NOT NULL,
      number_value VARCHAR(100) NOT NULL,
      PRIMARY KEY (number_type, number_value)
    ) ENGINE=InnoDB COLLATE=${collation}
  `);

  await dropTriggers(sequelize, READ_ONLY_TRIGGERS);

  await sequelize.query(`
    INSERT INTO asset_unique_numbers (number_type, number_value)
    SELECT 'CHASSIS', chassis_number FROM vehicles WHERE ${isPresent('chassis_number')}
    UNION ALL
    SELECT 'CHASSIS', serial_number FROM machinery WHERE ${isPresent('serial_number')}
    UNION ALL
    SELECT 'REGISTRATION', registration_number FROM vehicles WHERE ${isPresent('registration_number')}
  `);

  await createTriggers(sequelize, TRIGGERS);
}

async function down({ context: queryInterface }) {
  const { sequelize } = queryInterface;
  await dropTriggers(sequelize, TRIGGERS);
  await createTriggers(sequelize, READ_ONLY_TRIGGERS);
  await queryInterface.dropTable('asset_unique_numbers');
}

module.exports = { up, down };
