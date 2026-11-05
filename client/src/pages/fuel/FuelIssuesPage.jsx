import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fuelTransactionsApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { SOURCE_LABEL, formatCurrency, formatDateOnly, formatLitres, formatNumber, formatTimeOnly, meterUnitLabel } from '../../config/fuel';

function listParams(active, assetFilter) {
  return {
    search: active.search || undefined,
    assetType: assetFilter?.assetType || active.assetType || undefined,
    assetId: assetFilter?.assetId,
    source: active.source || undefined,
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
  if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  const assetType = assetFilter?.assetType || active.assetType;
  if (assetType) applied.push({ label: 'Asset type', value: assetType === 'VEHICLE' ? 'Vehicles' : 'Machinery' });
  if (active.source) applied.push({ label: 'Source', value: SOURCE_LABEL[active.source] ?? active.source });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'From', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'To', value: formatDateOnly(active.dateTo) });
  if (active.status === 'archived') applied.push({ label: 'Records', value: 'Deleted entries' });
  return applied;
}

export default function FuelIssuesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const assetFilter = searchParams.get('assetId') ? { assetType: searchParams.get('assetType') ?? '', assetId: searchParams.get('assetId') } : null;

  const [filters, setFilters] = useState({
    search: '',
    assetType: '',
    source: '',
    siteId: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    page: 1,
    sort: 'txnDate:desc',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(
    async (activeFilters) => {
      setError(null);
      try {
        const response = await fuelTransactionsApi.list({ ...listParams(activeFilters, assetFilter), page: activeFilters.page });
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

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await fuelTransactionsApi.remove(deleteTarget.id, 'DELETE');
      setNotice(
        deleteTarget.source === 'SITE_STOCK' ? `Fuel issue deleted — ${formatLitres(deleteTarget.quantity)} went back to site stock.` : 'Fuel issue deleted.'
      );
      setDeleteTarget(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  const columns = [
    {
      key: 'txnDate',
      label: 'Date & time',
      sortable: true,
      render: (r) => (
        <div className="flex flex-col">
          <span>{formatDateOnly(r.txnDate)}</span>
          {r.txnTime && <span className="text-xs text-steel-500 tabular-nums">{formatTimeOnly(r.txnTime)}</span>}
        </div>
      ),
    },
    {
      key: 'asset',
      label: 'Asset',
      render: (r) => {
        const label = r.assetLabel ?? r.assetId;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-steel-900">{label}</span>
            <span className="text-xs text-steel-500">
              {r.assetId} · {r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'source',
      label: 'Source',
      render: (r) => (
        <div className="flex flex-col">
          <Badge tone={r.source === 'SITE_STOCK' ? 'brand' : 'neutral'}>{SOURCE_LABEL[r.source] ?? r.source}</Badge>
          {r.fuelStationName && <span className="mt-0.5 text-xs text-steel-500">{r.fuelStationName}</span>}
        </div>
      ),
    },
    { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
    { key: 'fuelType', label: 'Fuel', render: (r) => r.fuelType ?? '—' },
    { key: 'quantity', label: 'Litres', sortable: true, render: (r) => <span className="tabular-nums">{formatLitres(r.quantity)}</span> },
    { key: 'pricePerLitre', label: 'Cost / L', render: (r) => <span className="tabular-nums">{formatCurrency(r.pricePerLitre)}</span> },
    { key: 'amount', label: 'Cost', sortable: true, render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.amount)}</span> },
    {
      key: 'meterReading',
      label: 'Meter',
      render: (r) => (
        <span className="tabular-nums">
          {formatNumber(r.meterReading)} {meterUnitLabel(r.meterType)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.status === 'archived' ? (
          <Badge tone="neutral">Deleted</Badge>
        ) : (
          <div className="flex items-center gap-3">
            <Can resource="FUEL" action="UPDATE">
              <Link to={`/fuel/issues/${r.id}/edit`} className="font-semibold text-brand-600 hover:underline">
                Edit
              </Link>
            </Can>
            <Can resource="FUEL" action="DELETE">
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(r);
                }}
              >
                Delete
              </button>
            </Can>
          </div>
        ),
    },
  ];

  const newEntryPath = assetFilter
    ? `/fuel/issues/new?assetType=${encodeURIComponent(assetFilter.assetType)}&assetId=${encodeURIComponent(assetFilter.assetId)}`
    : '/fuel/issues/new';

  async function buildPrintReport() {
    const { data } = await listAll(fuelTransactionsApi.list, listParams(filters, assetFilter));
    const total = (pick) => data.reduce((sum, r) => sum + (Number(pick(r)) || 0), 0);

    return {
      title: 'Fuel Issues',
      filters: [
        ...appliedFilters(filters, assetFilter, siteNames),
        {
          label: 'Sorted by',
          value: `${columns.find((c) => c.key === sortField).label}, ${sortDirection === 'asc' ? 'ascending' : 'descending'}`,
        },
      ],
      summary: [
        { label: 'Entries', value: formatNumber(data.length) },
        { label: 'Total litres', value: formatLitres(total((r) => r.quantity)) },
        { label: 'Total cost', value: formatCurrency(total((r) => r.amount)) },
      ],
      sections: [
        {
          title: 'Fuel issues',
          rows: data,
          getRowKey: (r) => r.id,
          emptyMessage: 'No fuel issues match these filters.',
          columns: [
            { key: 'txnDate', label: 'Date & time', render: (r) => [formatDateOnly(r.txnDate), r.txnTime ? formatTimeOnly(r.txnTime) : null] },
            { key: 'asset', label: 'Asset', render: (r) => [r.assetLabel ?? r.assetId, `${r.assetId} · ${r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}`] },
            { key: 'source', label: 'Source', render: (r) => [SOURCE_LABEL[r.source] ?? r.source, r.fuelStationName] },
            { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
            { key: 'fuelType', label: 'Fuel', render: (r) => r.fuelType ?? '—' },
            { key: 'quantity', label: 'Litres', align: 'right', render: (r) => formatLitres(r.quantity) },
            { key: 'pricePerLitre', label: 'Cost / L', align: 'right', render: (r) => formatCurrency(r.pricePerLitre) },
            { key: 'amount', label: 'Cost', align: 'right', render: (r) => formatCurrency(r.amount) },
            { key: 'meterReading', label: 'Meter', align: 'right', render: (r) => `${formatNumber(r.meterReading)} ${meterUnitLabel(r.meterType)}` },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Fuel Issues</h1>
          <p className="mt-1 text-steel-500">Fuel filled into each vehicle and machine — from site stock or directly at a pump.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="FUEL" action="CREATE">
            <Button as={Link} to={newEntryPath}>
              Issue fuel
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      {assetFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-brand-600/25 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span>
            Showing fuel for <span className="font-semibold">{assetFilter.assetId}</span>
          </span>
          <button type="button" className="font-semibold underline" onClick={() => setSearchParams({})}>
            Show all assets
          </button>
        </div>
      )}

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        <Input placeholder="Search asset ID, RCPL or registration no..." title="Search by asset ID, machinery RCPL or vehicle registration number"value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} disabled={Boolean(assetFilter)} />
        <Select value={assetFilter ? assetFilter.assetType : filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)} disabled={Boolean(assetFilter)}>
          <option value="">All asset types</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
        </Select>
        <Select value={filters.source} onChange={(e) => updateFilter('source', e.target.value)}>
          <option value="">All sources</option>
          <option value="SITE_STOCK">Site stock</option>
          <option value="DIRECT_PUMP">Direct at pump</option>
        </Select>
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">Active entries</option>
          <option value="archived">Deleted entries</option>
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading fuel issues" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No fuel issues match these filters."
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

      <DeleteWordModal
        open={Boolean(deleteTarget)}
        title="Delete this fuel issue?"
        description={
          deleteTarget
            ? `${formatLitres(deleteTarget.quantity)} for ${deleteTarget.assetLabel ?? deleteTarget.assetId} on ${formatDateOnly(deleteTarget.txnDate)}${deleteTarget.txnTime ? ` at ${formatTimeOnly(deleteTarget.txnTime)}` : ''}.${
                deleteTarget.source === 'SITE_STOCK' ? ' The fuel goes back into site stock at its original cost.' : ''
              }`
            : undefined
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        pending={deleting}
        error={deleteError}
      />
    </div>
  );
}
