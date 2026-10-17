const { DataTypes } = require('sequelize');

const PLACEHOLDER_PREFIX = 'RCPL-';

const ORPHAN_TRIGGERS = ['trg_machinery_identifiers_ai', 'trg_machinery_identifiers_au', 'trg_machinery_identifiers_ad'];

const CHASSIS_CHECK = (self, selfColumn, other, otherColumn, { excludeSelf }) => `
      IF NEW.${selfColumn} IS NOT NULL AND NEW.${selfColumn} <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM (
          SELECT id FROM ${self} WHERE ${selfColumn} = NEW.${selfColumn}${excludeSelf ? ' AND id <> NEW.id' : ''}
          UNION ALL
          SELECT id FROM ${other} WHERE ${otherColumn} = NEW.${selfColumn}
        ) AS dupes;
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This chassis number is already in use by another asset';
        END IF;
      END IF;`;

const VEHICLE_REGISTRATION_CHECK = ({ excludeSelf }) => `
      IF NEW.registration_number IS NOT NULL AND NEW.registration_number <> '' THEN
        SELECT COUNT(*) INTO dup_count FROM vehicles
         WHERE registration_number = NEW.registration_number${excludeSelf ? ' AND id <> NEW.id' : ''};
        IF dup_count > 0 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This registration number is already in use by another asset';
        END IF;
      END IF;`;

const TRIGGERS = [
  {
    name: 'trg_vehicles_unique_identifiers_ins',
    table: 'vehicles',
    timing: 'BEFORE INSERT',
    body: CHASSIS_CHECK('vehicles', 'chassis_number', 'machinery', 'serial_number', { excludeSelf: false }) + VEHICLE_REGISTRATION_CHECK({ excludeSelf: false }),
  },
  {
    name: 'trg_vehicles_unique_identifiers_upd',
    table: 'vehicles',
    timing: 'BEFORE UPDATE',
    body: CHASSIS_CHECK('vehicles', 'chassis_number', 'machinery', 'serial_number', { excludeSelf: true }) + VEHICLE_REGISTRATION_CHECK({ excludeSelf: true }),
  },
  {
    name: 'trg_machinery_unique_identifiers_ins',
    table: 'machinery',
    timing: 'BEFORE INSERT',
    body: CHASSIS_CHECK('machinery', 'serial_number', 'vehicles', 'chassis_number', { excludeSelf: false }),
  },
  {
    name: 'trg_machinery_unique_identifiers_upd',
    table: 'machinery',
    timing: 'BEFORE UPDATE',
    body: CHASSIS_CHECK('machinery', 'serial_number', 'vehicles', 'chassis_number', { excludeSelf: true }),
  },
];

async function dropTriggers(sequelize, names) {
  for (const name of names) await sequelize.query(`DROP TRIGGER IF EXISTS ${name}`);
}

async function createTriggers(sequelize) {
  for (const trigger of TRIGGERS) {
    await sequelize.query(`
      CREATE TRIGGER ${trigger.name}
      ${trigger.timing} ON ${trigger.table}
      FOR EACH ROW
      BEGIN
        DECLARE dup_count INT;
        ${trigger.body}
      END
    `);
  }
}

async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

  const duplicates = await select(
    `SELECT tenant_id AS tenantId, UPPER(TRIM(registration_number)) AS value, GROUP_CONCAT(asset_id ORDER BY id) AS assets
       FROM machinery
      WHERE registration_number IS NOT NULL AND TRIM(registration_number) <> ''
      GROUP BY tenant_id, UPPER(TRIM(registration_number))
     HAVING COUNT(*) > 1`
  );
  if (duplicates.length) {
    const list = duplicates.map((d) => `${d.value} (${d.assets})`).join('; ');
    throw new Error(`Cannot make RCPL unique: these machines share a registration number — fix them first: ${list}`);
  }

  await dropTriggers(sequelize, [...ORPHAN_TRIGGERS, ...TRIGGERS.map((t) => t.name)]);

  await queryInterface.renameColumn('machinery', 'registration_number', 'rcpl');
  await sequelize.query(`UPDATE machinery SET rcpl = NULLIF(UPPER(TRIM(rcpl)), '')`);

  const blanks = await select(`SELECT id, tenant_id AS tenantId FROM machinery WHERE rcpl IS NULL ORDER BY tenant_id, id`);
  const usedByTenant = new Map();
  for (const row of blanks) {
    if (!usedByTenant.has(row.tenantId)) {
      const used = await select(`SELECT rcpl FROM machinery WHERE tenant_id = :tenantId AND rcpl IS NOT NULL`, { tenantId: row.tenantId });
      usedByTenant.set(row.tenantId, { used: new Set(used.map((u) => u.rcpl)), next: 1 });
    }
    const tenant = usedByTenant.get(row.tenantId);
    while (tenant.used.has(`${PLACEHOLDER_PREFIX}${tenant.next}`)) tenant.next += 1;
    const value = `${PLACEHOLDER_PREFIX}${tenant.next}`;
    tenant.used.add(value);
    await sequelize.query(`UPDATE machinery SET rcpl = :value WHERE id = :id`, { replacements: { value, id: row.id } });
  }

  await queryInterface.changeColumn('machinery', 'rcpl', { type: DataTypes.STRING(32), allowNull: false });
  await queryInterface.addIndex('machinery', ['tenant_id', 'rcpl'], { unique: true, name: 'uq_machinery_tenant_rcpl' });

  await createTriggers(sequelize);
}

async function down({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  await dropTriggers(sequelize, TRIGGERS.map((t) => t.name));
  await queryInterface.removeIndex('machinery', 'uq_machinery_tenant_rcpl');
  await queryInterface.changeColumn('machinery', 'rcpl', { type: DataTypes.STRING(32), allowNull: true });
  await queryInterface.renameColumn('machinery', 'rcpl', 'registration_number');

  await require('./0016-enforce-unique-chassis-registration-numbers').up({ context: queryInterface });
}

module.exports = { up, down };
