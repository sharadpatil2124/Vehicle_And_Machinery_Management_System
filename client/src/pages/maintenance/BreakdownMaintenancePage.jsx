import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceApi } from '../../api/client';
import { Alert, Button, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import MaintenanceDialogs from '../../components/maintenance/MaintenanceDialogs';
import { AssetCell, DowntimeCell, RowActions, StageBadge } from '../../components/maintenance/MaintenanceCells';
import useNow from '../../hooks/useNow';
import useSiteNames from '../../hooks/useSiteNames';
import { elapsedMinutes, formatDateTime, formatDuration } from '../../config/maintenance';

function Stat({ label, value, tone = 'text-steel-900' }) {
  return (
    <div className="rounded border border-steel-200 bg-surface px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default function BreakdownMaintenancePage() {
  const now = useNow();
  const siteNames = useSiteNames();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await maintenanceApi.list({ type: 'breakdown', open: 'true', sort: 'reportedAt:asc', limit: 100 });
      setRows(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone(message) {
    setDialog(null);
    setNotice(message);
    load();
  }

  const totalDowntime = (rows ?? []).reduce((sum, r) => sum + elapsedMinutes(r.reportedAt, now), 0);
  const longest = (rows ?? []).reduce((max, r) => Math.max(max, elapsedMinutes(r.reportedAt, now)), 0);

  const columns = [
    { key: 'asset', label: 'Asset', render: (r) => <AssetCell record={r} /> },
    { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
    { key: 'reportedAt', label: 'Reported', render: (r) => formatDateTime(r.reportedAt) },
    { key: 'stage', label: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'description', label: 'Problem', wrap: true, render: (r) => <span className="line-clamp-2 max-w-xs">{r.description}</span> },
    { key: 'performedBy', label: 'Performed by', render: (r) => r.performedBy ?? '—' },
    { key: 'downtime', label: 'Down for', render: (r) => <DowntimeCell record={r} now={now} /> },
    { key: 'actions', label: '', render: (r) => <RowActions record={r} onAction={(kind, record) => setDialog({ kind, record })} /> },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Breakdown Maintenance</h1>
          <p className="mt-1 text-steel-500">
            Assets that are broken down right now. Downtime counts from when the breakdown was reported until it is resolved.
          </p>
        </div>
        <Can resource="MAINTENANCE" action="CREATE">
          <Button onClick={() => setDialog({ kind: 'create', preset: { type: 'breakdown' } })}>Report breakdown</Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      {rows && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Active breakdowns" value={rows.length} tone={rows.length ? 'text-danger-600' : 'text-steel-900'} />
          <Stat label="Combined downtime so far" value={rows.length ? formatDuration(totalDowntime) : '—'} />
          <Stat label="Longest current breakdown" value={rows.length ? formatDuration(longest) : '—'} />
        </div>
      )}

      <div className="rounded border border-steel-200 bg-surface">
        {!rows ? (
          error ? null : <Spinner label="Loading breakdowns" />
        ) : (
          <Table columns={columns} rows={rows} getRowKey={(r) => r.id} emptyMessage="No active breakdowns — every asset is running." />
        )}
      </div>

      <p className="mt-3 text-sm text-steel-500">
        Resolved breakdowns and their final downtime are in{' '}
        <Link to="/maintenance/history?type=breakdown" className="font-semibold text-brand-600 hover:underline">
          Maintenance History
        </Link>
        .
      </p>

      <MaintenanceDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={handleDone} />
    </div>
  );
}
