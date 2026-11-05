import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fuelCollectionsApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { COLLECTION_STATUS, formatCurrency, formatDateOnly, formatLitres, formatNumber } from '../../config/fuel';

function listParams(active) {
  return {
    search: active.search || undefined,
    status: active.status || undefined,
    siteId: active.siteId || undefined,
    dateFrom: active.dateFrom || undefined,
    dateTo: active.dateTo || undefined,
  };
}

function appliedFilters(active, siteNames) {
  const applied = [];
  if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  if (active.status) applied.push({ label: 'Status', value: COLLECTION_STATUS[active.status]?.label ?? active.status });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'From', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'To', value: formatDateOnly(active.dateTo) });
  return applied;
}

export default function FuelCollectionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [filters, setFilters] = useState({ search: '', status: '', siteId: '', dateFrom: '', dateTo: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice] = useState(location.state?.message ?? null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await fuelCollectionsApi.list({ ...listParams(activeFilters), page: activeFilters.page });
      setResult(response);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  async function buildPrintReport() {
    const { data } = await listAll(fuelCollectionsApi.list, listParams(filters));
    const counted = data.filter((c) => c.status !== 'cancelled');
    const total = (pick) => counted.reduce((sum, c) => sum + (Number(pick(c)) || 0), 0);

    return {
      title: 'Fuel Collections',
      filters: appliedFilters(filters, siteNames),
      summary: [
        { label: 'Collections', value: formatNumber(data.length) },
        { label: 'Litres (excl. cancelled)', value: formatLitres(total((c) => c.quantity)) },
        { label: 'Amount (excl. cancelled)', value: formatCurrency(total((c) => c.amount)) },
      ],
      sections: [
        {
          title: 'Fuel collections',
          rows: data,
          getRowKey: (c) => c.id,
          emptyMessage: 'No fuel collections match these filters.',
          columns: [
            { key: 'collectionNumber', label: 'Collection', render: (c) => c.collectionNumber },
            { key: 'collectionDate', label: 'Date', render: (c) => formatDateOnly(c.collectionDate) },
            { key: 'site', label: 'Site', render: (c) => c.siteName ?? '—' },
            { key: 'carrier', label: 'Carrier', render: (c) => [c.carrierLabel ?? '—', c.carrierAssetId] },
            { key: 'station', label: 'Station', render: (c) => c.fuelStationName ?? '—' },
            { key: 'fuelType', label: 'Fuel', render: (c) => c.fuelType },
            {
              key: 'quantity',
              label: 'Litres',
              align: 'right',
              render: (c) => [formatLitres(c.quantity), c.status === 'received' && c.shortageQuantity > 0 ? `${formatLitres(c.shortageQuantity)} short` : null],
            },
            { key: 'amount', label: 'Amount', align: 'right', render: (c) => formatCurrency(c.amount) },
            { key: 'status', label: 'Status', render: (c) => COLLECTION_STATUS[c.status]?.label ?? c.status },
          ],
        },
      ],
    };
  }

  const columns = [
    { key: 'collectionNumber', label: 'Collection' },
    { key: 'collectionDate', label: 'Date', render: (c) => formatDateOnly(c.collectionDate) },
    { key: 'site', label: 'Site', render: (c) => c.siteName ?? '—' },
    {
      key: 'carrier',
      label: 'Carrier',
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-steel-900">{c.carrierLabel ?? '—'}</span>
          <span className="text-xs text-steel-500">{c.carrierAssetId}</span>
        </div>
      ),
    },
    { key: 'station', label: 'Station', render: (c) => c.fuelStationName ?? '—' },
    { key: 'fuelType', label: 'Fuel' },
    {
      key: 'quantity',
      label: 'Litres',
      render: (c) => (
        <div className="flex flex-col tabular-nums">
          <span>{formatLitres(c.quantity)}</span>
          {c.status === 'received' && c.shortageQuantity > 0 && (
            <span className="text-xs text-danger-600">{formatLitres(c.shortageQuantity)} short</span>
          )}
        </div>
      ),
    },
    { key: 'amount', label: 'Amount', render: (c) => <span className="font-semibold tabular-nums">{formatCurrency(c.amount)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (c) => <Badge tone={COLLECTION_STATUS[c.status]?.tone}>{COLLECTION_STATUS[c.status]?.label ?? c.status}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (c) => (
        <Link to={`/fuel/collections/${c.id}`} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Fuel Collections</h1>
          <p className="mt-1 text-steel-500">Trips to the pump: fuel filled into cans, then received back at the site.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="FUEL_COLLECTION" action="CREATE">
            <Button as={Link} to="/fuel/collections/new">
              Record collection
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <Input placeholder="Search FC no, bill no or carrier reg..." title="Search by collection number, bill number or carrier vehicle registration number"value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(COLLECTION_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading fuel collections" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(c) => c.id} emptyMessage="No fuel collections match these filters." />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
