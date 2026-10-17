import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { maintenanceApi } from '../../api/client';
import { Alert, Badge, Button, Card, Pagination, Select, Spinner, Table, Tabs } from '../../components/ui';
import Can from '../../components/Can';
import MaintenanceDialogs from '../../components/maintenance/MaintenanceDialogs';
import { AssetCell, RowActions, StageBadge, assetDetailPath } from '../../components/maintenance/MaintenanceCells';
import useSiteNames from '../../hooks/useSiteNames';
import { SCHEDULE_STATE, formatDateTime } from '../../config/maintenance';
import { formatNumber, meterUnitLabel } from '../../config/fuel';

const PAGE_SIZE = 20;

const SCHEDULE_TABS = [
  { value: 'VEHICLE', label: 'Vehicles', noun: 'vehicles', subtitle: 'Light vehicles are serviced by KM, heavy vehicles by hours.' },
  { value: 'MACHINERY', label: 'Machinery', noun: 'machinery', subtitle: 'Serviced by operating hours.' },
];

function RemainingCell({ entry }) {
  const unit = meterUnitLabel(entry.meterType);
  if (entry.remaining <= 0) {
    return (
      <span className="font-semibold text-danger-600 tabular-nums">
        {formatNumber(-entry.remaining)} {unit} overdue
      </span>
    );
  }
  return (
    <span className={`tabular-nums ${entry.state === 'due_soon' ? 'font-semibold text-warning-600' : ''}`}>
      {formatNumber(entry.remaining)} {unit} left
    </span>
  );
}

function ScheduleCard({ subtitle, assetType, noun, refreshKey, siteNames, onSchedule, onThreshold }) {
  const [view, setView] = useState('attention');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    maintenanceApi
      .preventiveScheduleAssets({ assetType, view, page, limit: PAGE_SIZE })
      .then((response) => {
        if (cancelled) return;
        setResult(response);
        onThreshold(response.dueSoonThreshold);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [assetType, view, page, refreshKey, onThreshold]);

  useEffect(() => {
    const last = result?.pagination?.pages;
    if (last > 0 && page > last) setPage(last);
  }, [result, page]);

  function changeView(event) {
    setView(event.target.value);
    setPage(1);
  }

  const columns = [
    {
      key: 'asset',
      label: 'Asset',
      render: (e) => (
        <div className="flex flex-col">
          <Link to={assetDetailPath(e.assetType, e.assetRecordId)} className="font-semibold text-brand-600 hover:underline">
            {e.assetLabel}
          </Link>
          <span className="text-xs text-steel-500">{e.assetId}</span>
        </div>
      ),
    },
    { key: 'siteId', label: 'Site', render: (e) => siteNames[e.siteId] ?? '—' },
    { key: 'meter', label: 'Measured in', render: (e) => (e.meterType === 'HOURS' ? 'Hours' : 'KM') },
    {
      key: 'currentReading',
      label: 'Current',
      align: 'right',
      render: (e) => <span className="tabular-nums">{formatNumber(e.currentReading)} {meterUnitLabel(e.meterType)}</span>,
    },
    {
      key: 'nextServiceAt',
      label: 'Service due at',
      align: 'right',
      render: (e) => <span className="tabular-nums">{formatNumber(e.nextServiceAt)} {meterUnitLabel(e.meterType)}</span>,
    },
    { key: 'remaining', label: 'Remaining', align: 'right', render: (e) => <RemainingCell entry={e} /> },
    { key: 'state', label: 'Status', render: (e) => <Badge tone={SCHEDULE_STATE[e.state].tone}>{SCHEDULE_STATE[e.state].label}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (e) =>
        e.openMaintenance ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-steel-500">
            Work order <StageBadge stage={e.openMaintenance.stage} />
          </span>
        ) : (
          <Can resource="MAINTENANCE" action="CREATE">
            <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onSchedule(e)}>
              Schedule
            </button>
          </Can>
        ),
    },
  ];

  return (
    <Card
      subtitle={subtitle}
      actions={
        <div className="w-56">
          <Select value={view} onChange={changeView} aria-label={`Which ${noun} to show`}>
            <option value="attention">Overdue and due soon</option>
            <option value="all">All scheduled {noun}</option>
          </Select>
        </div>
      }
    >
      <div className="-mx-5 -my-4">
        {error ? (
          <div className="px-5 py-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : !result ? (
          <Spinner label={`Loading ${noun}`} />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(e) => e.assetId}
              emptyMessage={view === 'all' ? `No ${noun} have a service target yet.` : 'Nothing here needs attention.'}
            />
            {result.pagination.total > 0 && (
              <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={setPage} />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function PreventiveMaintenancePage() {
  const siteNames = useSiteNames();
  const [threshold, setThreshold] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleTab, setScheduleTab] = useState('VEHICLE');
  const [openWork, setOpenWork] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshKey((key) => key + 1);
    try {
      const openResponse = await maintenanceApi.list({ type: 'preventive', open: 'true', sort: 'reportedAt:asc', limit: 100 });
      setOpenWork(openResponse.data);
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

  function scheduleFor(entry) {
    setDialog({
      kind: 'create',
      preset: { type: 'preventive', assetType: entry.assetType, assetId: entry.assetId, assetLabel: entry.assetLabel, meterType: entry.meterType },
    });
  }

  const activeSchedule = SCHEDULE_TABS.find((t) => t.value === scheduleTab);

  const openColumns = [
    { key: 'asset', label: 'Asset', render: (r) => <AssetCell record={r} /> },
    { key: 'reportedAt', label: 'Scheduled', render: (r) => formatDateTime(r.reportedAt) },
    { key: 'stage', label: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'description', label: 'Work', wrap: true, render: (r) => <span className="line-clamp-2 max-w-xs">{r.description}</span> },
    { key: 'performedBy', label: 'Performed by', render: (r) => r.performedBy ?? '—' },
    { key: 'actions', label: '', render: (r) => <RowActions record={r} onAction={(kind, record) => setDialog({ kind, record })} /> },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Preventive Maintenance</h1>
          <p className="mt-1 text-steel-500">
            Services due by meter reading — kilometres for light vehicles, operating hours for heavy vehicles and machinery.
          </p>
        </div>
        <Can resource="MAINTENANCE" action="CREATE">
          <Button onClick={() => setDialog({ kind: 'create', preset: { type: 'preventive' } })}>Schedule maintenance</Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      {!openWork ? (
        error ? null : <Spinner label="Loading preventive maintenance" />
      ) : (
        <>
          <Card title="Open preventive work" subtitle="Scheduled or in progress. Completing one records the meter reading and sets the next service target.">
            <div className="-mx-5 -my-4">
              <Table columns={openColumns} rows={openWork} getRowKey={(r) => r.id} emptyMessage="No preventive work is open." />
            </div>
          </Card>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-steel-900">Service schedule</h2>
              {threshold && (
                <p className="mt-0.5 text-sm text-steel-500">
                  Due soon means within {formatNumber(threshold.KM)} KM or {formatNumber(threshold.HOURS)} hours of the service target.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3">
            <Tabs tabs={SCHEDULE_TABS} active={scheduleTab} onChange={setScheduleTab} />
          </div>

          <ScheduleCard
            key={activeSchedule.value}
            subtitle={activeSchedule.subtitle}
            assetType={activeSchedule.value}
            noun={activeSchedule.noun}
            refreshKey={refreshKey}
            siteNames={siteNames}
            onSchedule={scheduleFor}
            onThreshold={setThreshold}
          />
        </>
      )}

      <MaintenanceDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={handleDone} />
    </div>
  );
}
