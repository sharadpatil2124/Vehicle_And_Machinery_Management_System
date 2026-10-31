import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAll, maintenanceApi } from '../../api/client';
import { Alert, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import MaintenanceDialogs from '../../components/maintenance/MaintenanceDialogs';
import {
  AssetCell,
  AssetPrintCell,
  DowntimeCell,
  RowActions,
  StageBadge,
  TypeBadge,
  downtimeText,
} from '../../components/maintenance/MaintenanceCells';
import { useAuth } from '../../context/AuthContext';
import useNow from '../../hooks/useNow';
import useSiteNames from '../../hooks/useSiteNames';
import { MAINTENANCE_TYPE, STAGE, formatDateTime } from '../../config/maintenance';
import { formatCurrency, formatDateOnly, formatNumber, meterUnitLabel } from '../../config/fuel';

function listParams(active, assetFilter) {
  return {
    search: assetFilter ? undefined : active.search || undefined,
    assetType: assetFilter?.assetType || active.assetType || undefined,
    assetId: assetFilter?.assetId,
    type: active.type || undefined,
    stage: active.stage || undefined,
    siteId: active.siteId || undefined,
    dateFrom: active.dateFrom || undefined,
    dateTo: active.dateTo || undefined,
    status: active.status || undefined,
    sort: active.sort,
  };
}

function appliedFilters(active, assetFilter, siteNames) {
  const applied = [];
  if (assetFilter) applied.push({ label: 'Asset', value: assetFilter.assetId });
  else if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  const assetType = assetFilter ? assetFilter.assetType : active.assetType;
  if (assetType) applied.push({ label: 'Asset type', value: assetType === 'VEHICLE' ? 'Vehicles' : 'Machinery' });
  if (active.type) applied.push({ label: 'Type', value: MAINTENANCE_TYPE[active.type].label });
  if (active.stage) applied.push({ label: 'Stage', value: STAGE[active.stage].label });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'Reported from', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'Reported to', value: formatDateOnly(active.dateTo) });
  if (active.status === 'archived') applied.push({ label: 'Records', value: 'Deleted records' });
  return applied;
}

export default function MaintenanceHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const now = useNow();

  const assetFilter = searchParams.get('assetId')
    ? { assetType: searchParams.get('assetType') ?? '', assetId: searchParams.get('assetId') }
    : null;

  const [filters, setFilters] = useState({
    search: '',
    assetType: '',
    type: ['preventive', 'breakdown'].includes(searchParams.get('type')) ? searchParams.get('type') : '',
    stage: '',
    siteId: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    page: 1,
    sort: 'reportedAt:desc',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(
    async (active) => {
      setError(null);
      try {
        const response = await maintenanceApi.list({ ...listParams(active, assetFilter), page: active.page });
        setResult(response);
      } catch (err) {
        setError(err.message);
      }
    },
    [assetFilter?.assetType, assetFilter?.assetId]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      const direction = currentField === field && currentDirection === 'desc' ? 'asc' : 'desc';
      return { ...f, sort: `${field}:${direction}` };
    });
  }

  function handleDone(message) {
    setDialog(null);
    setNotice(message);
    load(filters);
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  async function buildPrintReport(generatedAt) {
    const { data } = await listAll(maintenanceApi.list, listParams(filters, assetFilter));
    const totalCost = data.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);

    return {
      title: 'Maintenance History',
      filters: [
        ...appliedFilters(filters, assetFilter, siteNames),
        {
          label: 'Sorted by',
          value: `${columns.find((c) => c.key === sortField).label}, ${sortDirection === 'asc' ? 'ascending' : 'descending'}`,
        },
      ],
      summary: [
        { label: 'Records', value: formatNumber(data.length) },
        { label: 'Total cost', value: formatCurrency(totalCost) },
      ],
      sections: [
        {
          title: 'Maintenance records',
          rows: data,
          getRowKey: (r) => r.id,
          emptyMessage: 'No maintenance records match these filters.',
          columns: [
            { key: 'reportedAt', label: 'Reported', render: (r) => formatDateTime(r.reportedAt) },
            { key: 'asset', label: 'Asset', render: (r) => <AssetPrintCell record={r} /> },
            { key: 'type', label: 'Type', render: (r) => MAINTENANCE_TYPE[r.type].label },
            { key: 'stage', label: 'Stage', render: (r) => STAGE[r.stage].label },
            { key: 'description', label: 'Description', render: (r) => r.description },
            { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
            { key: 'completedAt', label: 'Completed', render: (r) => formatDateTime(r.completedAt) },
            { key: 'downtime', label: 'Downtime', render: (r) => downtimeText(r, generatedAt) },
            {
              key: 'meterReading',
              label: 'Meter',
              align: 'right',
              render: (r) => (r.meterReading === null ? '—' : `${formatNumber(r.meterReading)} ${meterUnitLabel(r.meterType)}`),
            },
            { key: 'totalCost', label: 'Total cost', align: 'right', render: (r) => formatCurrency(r.totalCost) },
          ],
        },
      ],
    };
  }

  const columns = [
    { key: 'reportedAt', label: 'Reported', sortable: true, render: (r) => formatDateTime(r.reportedAt) },
    { key: 'asset', label: 'Asset', render: (r) => <AssetCell record={r} /> },
    { key: 'type', label: 'Type', render: (r) => <TypeBadge type={r.type} /> },
    { key: 'stage', label: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
    { key: 'description', label: 'Description', wrap: true, render: (r) => <span className="line-clamp-2 max-w-xs">{r.description}</span> },
    { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
    { key: 'completedAt', label: 'Completed', sortable: true, render: (r) => formatDateTime(r.completedAt) },
    { key: 'downtimeMinutes', label: 'Downtime', sortable: true, render: (r) => <DowntimeCell record={r} now={now} /> },
    {
      key: 'meterReading',
      label: 'Meter',
      align: 'right',
      render: (r) => (r.meterReading === null ? '—' : <span className="tabular-nums">{formatNumber(r.meterReading)} {meterUnitLabel(r.meterType)}</span>),
    },
    {
      key: 'totalCost',
      label: 'Total cost',
      sortable: true,
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatCurrency(r.totalCost)}</span>,
    },
    { key: 'actions', label: '', render: (r) => <RowActions record={r} onAction={(kind, record) => setDialog({ kind, record })} /> },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Maintenance History</h1>
          <p className="mt-1 text-steel-500">Every preventive service and breakdown, newest first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="MAINTENANCE" action="CREATE">
            <Button onClick={() => setDialog({ kind: 'create' })}>Record maintenance</Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      {assetFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-brand-600/25 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span>
            Showing maintenance for <span className="font-semibold">{assetFilter.assetId}</span>
          </span>
          <button type="button" className="font-semibold underline" onClick={() => setSearchParams({})}>
            Show all assets
          </button>
        </div>
      )}

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4 xl:grid-cols-8' : 'lg:grid-cols-4 xl:grid-cols-7'}`}>
        <Input placeholder="Search asset ID, RCPL or registration no..." title="Search by asset ID, machinery RCPL or vehicle registration number" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} disabled={Boolean(assetFilter)} />
        <Select value={assetFilter ? assetFilter.assetType : filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)} disabled={Boolean(assetFilter)} aria-label="Asset type">
          <option value="">All asset types</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
        </Select>
        <Select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)} aria-label="Maintenance type">
          <option value="">All types</option>
          <option value="preventive">Preventive</option>
          <option value="breakdown">Breakdown</option>
        </Select>
        <Select value={filters.stage} onChange={(e) => updateFilter('stage', e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          <option value="reported">Reported</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </Select>
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)} aria-label="Site">
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" aria-label="Reported from" title="Reported from" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        <Input type="date" aria-label="Reported to" title="Reported to" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} aria-label="Record status">
          <option value="">Active records</option>
          <option value="archived">Deleted records</option>
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          error ? null : <Spinner label="Loading maintenance history" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No maintenance records match these filters."
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>

      <MaintenanceDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={handleDone} />
    </div>
  );
}
