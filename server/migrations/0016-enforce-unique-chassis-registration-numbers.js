const TRIGGERS = [
  {
    name: 'trg_vehicles_unique_identifiers_ins',
    table: 'vehicles',
    timing: 'BEFORE INSERT',
    body: `
      DECLARE dup_count INT;

      IF NEW.chassis_number IS NOT NULL AND NEW.chassis_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM vehicles WHERE chassis_number = NEW.chassis_number
          UNION ALL
          SELECT id FROM machinery WHERE serial_number = NEW.chassis_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This chassis number is already in use by another asset';
        END IF;
      END IF;

      IF NEW.registration_number IS NOT NULL AND NEW.registration_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM vehicles WHERE registration_number = NEW.registration_number
          UNION ALL
          SELECT id FROM machinery WHERE registration_number = NEW.registration_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration number is already in use by another asset';
        END IF;
      END IF;
    `,
  },
  {
    name: 'trg_vehicles_unique_identifiers_upd',
    table: 'vehicles',
    timing: 'BEFORE UPDATE',
    body: `
      DECLARE dup_count INT;

      IF NEW.chassis_number IS NOT NULL AND NEW.chassis_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM vehicles WHERE chassis_number = NEW.chassis_number AND id <> NEW.id
          UNION ALL
          SELECT id FROM machinery WHERE serial_number = NEW.chassis_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This chassis number is already in use by another asset';
        END IF;
      END IF;

      IF NEW.registration_number IS NOT NULL AND NEW.registration_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM vehicles WHERE registration_number = NEW.registration_number AND id <> NEW.id
          UNION ALL
          SELECT id FROM machinery WHERE registration_number = NEW.registration_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration number is already in use by another asset';
        END IF;
      END IF;
    `,
  },
  {
    name: 'trg_machinery_unique_identifiers_ins',
    table: 'machinery',
    timing: 'BEFORE INSERT',
    body: `
      DECLARE dup_count INT;

      IF NEW.serial_number IS NOT NULL AND NEW.serial_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM machinery WHERE serial_number = NEW.serial_number
          UNION ALL
          SELECT id FROM vehicles WHERE chassis_number = NEW.serial_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This chassis number is already in use by another asset';
        END IF;
      END IF;

      IF NEW.registration_number IS NOT NULL AND NEW.registration_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM machinery WHERE registration_number = NEW.registration_number
          UNION ALL
          SELECT id FROM vehicles WHERE registration_number = NEW.registration_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration number is already in use by another asset';
        END IF;
      END IF;
    `,
  },
  {
    name: 'trg_machinery_unique_identifiers_upd',
    table: 'machinery',
    timing: 'BEFORE UPDATE',
    body: `
      DECLARE dup_count INT;

      IF NEW.serial_number IS NOT NULL AND NEW.serial_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM machinery WHERE serial_number = NEW.serial_number AND id <> NEW.id
          UNION ALL
          SELECT id FROM vehicles WHERE chassis_number = NEW.serial_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This chassis number is already in use by another asset';
        END IF;
      END IF;

      IF NEW.registration_number IS NOT NULL AND NEW.registration_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM machinery WHERE registration_number = NEW.registration_number AND id <> NEW.id
          UNION ALL
          SELECT id FROM vehicles WHERE registration_number = NEW.registration_number
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration number is already in use by another asset';
        END IF;
      END IF;
    `,
  },
];

/**
 * Database-level backstop for Chassis Number / Registration Number
 * uniqueness (client's request: enforce it even against a raw SQL write that
 * bypasses the application entirely). A single UNIQUE INDEX cannot span two
 * different tables in MySQL, and "Chassis Number" spans `vehicles` and
 * `machinery` together (as `chassis_number` on one, `serial_number` on the
 * other — the machinery field is only labelled "Chassis Number" in the UI),
 * so this is done with triggers instead.
 *
 * The application's own pre-check (`assetIdentifier.service.js`) is what a
 * normal request actually hits — it runs first and produces a clean,
 * specific error. These triggers only fire when that check was skipped
 * entirely (a direct database write) or lost a race against a concurrent
 * request; `errorHandler.js` translates the raw SIGNAL error into the same
 * kind of response either way.
 */
async function up({ context: queryInterface }) {
  for (const trigger of TRIGGERS) {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER ${trigger.name}
      ${trigger.timing} ON ${trigger.table}
      FOR EACH ROW
      BEGIN
        ${trigger.body}
      END
    `);
  }
}

async function down({ context: queryInterface }) {
  for (const trigger of TRIGGERS) {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${trigger.name}`);
  }
}

module.exports = { up, down };
