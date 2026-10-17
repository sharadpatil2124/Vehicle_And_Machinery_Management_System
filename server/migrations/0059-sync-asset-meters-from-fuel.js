const { DataTypes, QueryTypes } = require('sequelize');

const HOURS_BASED_VEHICLE_TYPE = 'Heavy Vehicle';

const ASSETS = [
  {
    assetType: 'VEHICLE',
    table: 'vehicles',
    entityType: 'Vehicle',
    meterSql: `CASE WHEN a.type = :hoursType THEN 'HOURS' ELSE 'KM' END`,
    currentSql: `CASE WHEN f.meter_type = 'HOURS' THEN a.current_hours ELSE a.current_km END`,
    columnFor: (meterType) => (meterType === 'HOURS' ? 'current_hours' : 'current_km'),
    fieldFor: (meterType) => (meterType === 'HOURS' ? 'currentHours' : 'currentKM'),
  },
  {
    assetType: 'MACHINERY',
    table: 'machinery',
    entityType: 'Machinery',
    meterSql: `'HOURS'`,
    currentSql: 'a.current_hours',
    columnFor: () => 'current_hours',
    fieldFor: () => 'currentHours',
  },
];

async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  const columns = await queryInterface.describeTable('fuel_transactions');
  if (!columns.asset_meter_before) {
    await queryInterface.addColumn('fuel_transactions', 'asset_meter_before', {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    });
  }

  await sequelize.transaction(async (transaction) => {
    for (const asset of ASSETS) {
      const behind = await sequelize.query(
        `SELECT a.id, a.tenant_id AS tenantId, f.id AS fuelId, f.meter_type AS meterType, f.meter_reading AS reading,
                ${asset.currentSql} AS current
           FROM ${asset.table} a
           JOIN fuel_transactions f
             ON f.tenant_id = a.tenant_id AND f.asset_type = :assetType AND f.asset_id = a.asset_id
            AND f.status = 'active' AND f.meter_type = ${asset.meterSql}
          WHERE f.id = (
                  SELECT f2.id FROM fuel_transactions f2
                   WHERE f2.tenant_id = f.tenant_id AND f2.asset_type = f.asset_type AND f2.asset_id = f.asset_id
                     AND f2.meter_type = f.meter_type AND f2.status = 'active'
                   ORDER BY f2.meter_reading DESC, f2.id DESC LIMIT 1)
            AND (${asset.currentSql} IS NULL OR f.meter_reading > ${asset.currentSql})`,
        { replacements: { assetType: asset.assetType, hoursType: HOURS_BASED_VEHICLE_TYPE }, type: QueryTypes.SELECT, transaction }
      );

      const now = new Date();
      for (const row of behind) {
        const column = asset.columnFor(row.meterType);
        const field = asset.fieldFor(row.meterType);
        const previous = row.current == null ? null : Number(row.current);
        const reading = Number(row.reading);

        await sequelize.query(`UPDATE ${asset.table} SET ${column} = :reading, updated_at = :now WHERE id = :id`, {
          replacements: { reading, now, id: row.id },
          transaction,
        });
        await sequelize.query(`UPDATE fuel_transactions SET asset_meter_before = :previous WHERE id = :fuelId`, {
          replacements: { previous: previous ?? 0, fuelId: row.fuelId },
          transaction,
        });
        await queryInterface.bulkInsert(
          'audit_logs',
          [
            {
              tenant_id: row.tenantId,
              entity_type: asset.entityType,
              entity_id: String(row.id),
              action: 'UPDATED',
              before: JSON.stringify({ [field]: previous }),
              after: JSON.stringify({ [field]: reading, source: `fuel transaction ${row.fuelId}` }),
              performed_by: null,
              created_at: now,
            },
          ],
          { transaction }
        );
      }
    }
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('fuel_transactions', 'asset_meter_before');
}

module.exports = { up, down };
