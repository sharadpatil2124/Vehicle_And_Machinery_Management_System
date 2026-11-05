const { DataTypes, QueryTypes } = require('sequelize');

// One active tyre per position: an older tyre still marked as fitted is replaced by the next one fitted there.
// The old Scrapped / Returned labels and removal reasons are removed; each row keeps its dates and readings.
async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  await queryInterface.addColumn('tyre_fitments', 'replaced_by_fitment_id', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
  await queryInterface.addConstraint('tyre_fitments', {
    type: 'foreign key',
    fields: ['replaced_by_fitment_id'],
    name: 'fk_tyre_fitments_replaced_by',
    references: { table: 'tyre_fitments', field: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await sequelize.transaction(async (transaction) => {
    const superseded = await sequelize.query(
      `SELECT id, tenantId, updatedBy, nextId, nextFittedAt, nextReading
         FROM (SELECT id, tenant_id AS tenantId, updated_by AS updatedBy,
                      LEAD(id) OVER w AS nextId,
                      LEAD(fitted_at) OVER w AS nextFittedAt,
                      LEAD(fit_meter_reading) OVER w AS nextReading
                 FROM tyre_fitments
                WHERE removed_at IS NULL
               WINDOW w AS (PARTITION BY tenant_id, asset_type, asset_id, position ORDER BY fitted_at, id)) ordered
        WHERE nextId IS NOT NULL`,
      { type: QueryTypes.SELECT, transaction }
    );

    const now = new Date();
    for (const row of superseded) {
      await sequelize.query(
        `UPDATE tyre_fitments
            SET removed_at = :removedAt, remove_meter_reading = :reading, removed_by = :removedBy, replaced_by_fitment_id = :replacedBy, updated_at = :now
          WHERE id = :id`,
        { replacements: { removedAt: row.nextFittedAt, reading: row.nextReading, removedBy: row.updatedBy, replacedBy: row.nextId, now, id: row.id }, transaction }
      );
      await queryInterface.bulkInsert(
        'audit_logs',
        [
          {
            tenant_id: row.tenantId,
            entity_type: 'TyreFitment',
            entity_id: String(row.id),
            action: 'UPDATED',
            before: JSON.stringify({ removedAt: null }),
            after: JSON.stringify({ removedAt: row.nextFittedAt, removeMeterReading: Number(row.nextReading), replacedByFitmentId: row.nextId, source: 'one active tyre per position' }),
            performed_by: null,
            created_at: now,
          },
        ],
        { transaction }
      );
    }
  });

  await queryInterface.removeColumn('tyre_fitments', 'removal_reason');
  await queryInterface.removeColumn('tyre_fitments', 'removal_outcome');

  await sequelize.query(
    'ALTER TABLE tyre_fitments ADD COLUMN active_position VARCHAR(50) GENERATED ALWAYS AS (IF(removed_at IS NULL, position, NULL)) STORED'
  );
  await queryInterface.addConstraint('tyre_fitments', {
    type: 'unique',
    fields: ['tenant_id', 'asset_type', 'asset_id', 'active_position'],
    name: 'uq_tyre_fitments_active_position',
  });
}

// The schema is restored, but the removed labels and reasons cannot be: those values are gone.
async function down({ context: queryInterface }) {
  await queryInterface.removeConstraint('tyre_fitments', 'uq_tyre_fitments_active_position');
  await queryInterface.removeColumn('tyre_fitments', 'active_position');
  await queryInterface.addColumn('tyre_fitments', 'removal_reason', { type: DataTypes.ENUM('WORN_OUT', 'PUNCTURE', 'DAMAGED', 'OTHER'), allowNull: true });
  await queryInterface.addColumn('tyre_fitments', 'removal_outcome', { type: DataTypes.ENUM('scrapped', 'returned'), allowNull: true });
  await queryInterface.removeConstraint('tyre_fitments', 'fk_tyre_fitments_replaced_by');
  await queryInterface.removeColumn('tyre_fitments', 'replaced_by_fitment_id');
}

module.exports = { up, down };
