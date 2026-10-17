import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceApi } from '../../api/client';
import { Alert, Button, Card, Pagination, Spinner, Table } from '../ui';
import Can from '../Can';
import MaintenanceDialogs from './MaintenanceDialogs';
import { DowntimeCell, RowActions, StageBadge, TypeBadge } from './MaintenanceCells';
import useNow from '../../hooks/useNow';
import { formatDateTime } from '../../config/maintenance';
import { assetDisplayName, formatCurrency, meterTypeForAsset } from '../../config/fuel';

const PAGE_SIZE = 10;

export default function MaintenanceHistoryCard({ assetType, asset, onAssetChanged }) {
  const now = useNow();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setResult(await maintenanceApi.list({ assetType, assetId: asset.assetId, page, limit: PAGE_SIZE }));
    } catch (err) {
      setError(err.message);
    }
  }, [assetType, asset.assetId, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone(message) {
    setDialog(null);
    setNotice(message);
    load();
    onAssetChanged?.();
  }

  const preset = (type) => ({
    type,
    assetType,
    assetId: asset.assetId,
    assetLabel: assetDisplayName(assetType, asset),
    meterType: meterTypeForAsset(assetType, asset),
  });

  const columns = [
    { key: 'reportedAt', label: 'Reported', render: (r) => formatDateTime(r.reportedAt) },
    { key: 'type', label: 'Type', render: (r) => <TypeBadge type={r.type} /> },
    { key: 'stage', label: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'description', label: 'Description', wrap: true, render: (r) => <span className="line-clamp-2 max-w-xs">{r.description}</span> },
    { key: 'completedAt', label: 'Completed', render: (r) => formatDateTime(r.completedAt) },
    { key: 'downtime', label: 'Downtime', render: (r) => <DowntimeCell record={r} now={now} /> },
    { key: 'totalCost', label: 'Total cost', align: 'right', render: (r) => <span className="tabular-nums">{formatCurrency(r.totalCost)}</span> },
    { key: 'actions', label: '', render: (r) => <RowActions record={r} onAction={(kind, record) => setDialog({ kind, record })} /> },
  ];

  const actions =
    asset.status === 'active' ? (
      <Can resource="MAINTENANCE" action="CREATE">
        <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'create', preset: preset('preventive') })}>
          Schedule preventive
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'create', preset: preset('breakdown') })}>
          Report breakdown
        </Button>
      </Can>
    ) : null;

  return (
    <Card title="Maintenance" subtitle="Preventive services and breakdowns for this asset, newest first." actions={actions} className="mt-4">
      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>
      {!result ? (
        error ? null : <Spinner label="Loading maintenance" />
      ) : (
        <>
          <div className="-mx-5">
            <Table columns={columns} rows={result.data} getRowKey={(r) => r.id} emptyMessage="No maintenance has been recorded for this asset yet." />
          </div>
          {result.pagination.pages > 1 && (
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={setPage} />
          )}
          {result.pagination.total > 0 && (
            <Link
              to={`/maintenance/history?assetType=${assetType}&assetId=${encodeURIComponent(asset.assetId)}`}
              className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
            >
              Open in Maintenance History →
            </Link>
          )}
        </>
      )}

      <MaintenanceDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={handleDone} />
    </Card>
  );
}
