const { QueryTypes } = require('sequelize');

const ASSETS = [
  { assetType: 'VEHICLE', table: 'vehicles' },
  { assetType: 'MACHINERY', table: 'machinery' },
];

// Open jobs now move with their asset. Jobs left behind by earlier transfers are brought into line once.
async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  await sequelize.transaction(async (transaction) => {
    for (const asset of ASSETS) {
      const stranded = await sequelize.query(
        `SELECT m.id, m.tenant_id AS tenantId, m.site_id AS siteId, a.current_site_id AS assetSiteId
           FROM maintenance m
           JOIN ${asset.table} a ON a.tenant_id = m.tenant_id AND a.asset_id = m.asset_id
          WHERE m.asset_type = :assetType AND m.status = 'active' AND m.stage <> 'resolved'
            AND NOT (m.site_id <=> a.current_site_id)`,
        { replacements: { assetType: asset.assetType }, type: QueryTypes.SELECT, transaction }
      );

      const now = new Date();
      for (const job of stranded) {
        await sequelize.query('UPDATE maintenance SET site_id = :siteId, updated_at = :now WHERE id = :id', {
          replacements: { siteId: job.assetSiteId, now, id: job.id },
          transaction,
        });
        await queryInterface.bulkInsert(
          'audit_logs',
          [
            {
              tenant_id: job.tenantId,
              entity_type: 'Maintenance',
              entity_id: String(job.id),
              action: 'UPDATED',
              before: JSON.stringify({ siteId: job.siteId }),
              after: JSON.stringify({ siteId: job.assetSiteId, source: 'open job moved to its asset site' }),
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

// The earlier site of each job is kept in the audit log; nothing to undo in the schema.
async function down() {}

module.exports = { up, down };
