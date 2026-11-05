import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adblueApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, formatDateOnly, formatLitres, formatNumber } from '../../config/fuel';

function listParams(active) {
  return {
    search: active.search || undefined,
    assetType: active.assetType || undefined,
    siteId: active.siteId || undefined,
    dateFrom: active.dateFrom || undefined,
    dateTo: active.dateTo || undefined,
    status: active.status || undefined,
    sort: active.sort,
  };
}

function appliedFilters(active, siteNames) {
  const applied = [];
  if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  if (active.assetType) applied.push({ label: 'Asset type', value: active.assetType === 'VEHICLE' ? 'Vehicles' : 'Machinery' });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'From', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'To', value: formatDateOnly(active.dateTo) });
  if (active.status === 'archived') applied.push({ label: 'Records', value: 'Deleted entries' });
  return applied;
}

export default function AdBlueFillingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [filters, setFilters] = useState({ search: '', assetType: '', siteId: '', dateFrom: '', dateTo: '', status: '', page: 1, sort: 'fillingDate:desc' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      setResult(await adblueApi.listFillings({ ...listParams(active), page: active.page }));
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
      await adblueApi.removeFilling(deleteTarget.id, 'DELETE');
      setNotice(`Filling deleted — ${formatLitres(deleteTarget.quantity)} went back to site stock.`);
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
    { key: 'fillingDate', label: 'Filling date', sortable: true, render: (r) => formatDateOnly(r.fillingDate) },
    {
      key: 'asset',
      label: 'Vehicle / Machinery',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.assetLabel ?? r.assetId}</span>
          <span className="text-xs text-steel-500">
            {r.assetId} · {r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
          </span>
        </div>
      ),
    },
    { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
    { key: 'quantity', label: 'Litres', sortable: true, render: (r) => <span className="tabular-nums">{formatLitres(r.quantity)}</span> },
    { key: 'ratePerLitre', label: 'Rate / L', render: (r) => <span className="tabular-nums">{formatCurrency(r.ratePerLitre)}</span> },
    { key: 'totalCost', label: 'Total cost', sortable: true, render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.totalCost)}</span> },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.status === 'archived' ? (
          <Badge tone="neutral">Deleted</Badge>
        ) : (
          <div className="flex items-center gap-3">
            <Can resource="ADBLUE" action="UPDATE">
              <Link to={`/adblue/fillings/${r.id}/edit`} className="font-semibold text-brand-600 hover:underline">
                Edit
              </Link>
            </Can>
            <Can resource="ADBLUE" action="DELETE">
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

  async function buildPrintReport() {
    const { data } = await listAll(adblueApi.listFillings, listParams(filters));
    const total = (pick) => data.reduce((sum, r) => sum + (Number(pick(r)) || 0), 0);

    return {
      title: 'AdBlue Filling Records',
      filters: [
        ...appliedFilters(filters, siteNames),
        {
          label: 'Sorted by',
          value: `${columns.find((c) => c.key === sortField).label}, ${sortDirection === 'asc' ? 'ascending' : 'descending'}`,
        },
      ],
      summary: [
        { label: 'Fillings', value: formatNumber(data.length) },
        { label: 'Total litres', value: formatLitres(total((r) => r.quantity)) },
        { label: 'Total cost', value: formatCurrency(total((r) => r.totalCost)) },
      ],
      sections: [
        {
          title: 'AdBlue fillings',
          rows: data,
          getRowKey: (r) => r.id,
          emptyMessage: 'No AdBlue fillings match these filters.',
          columns: [
            { key: 'fillingDate', label: 'Filling date', render: (r) => formatDateOnly(r.fillingDate) },
            { key: 'asset', label: 'Vehicle / Machinery', render: (r) => [r.assetLabel ?? r.assetId, `${r.assetId} · ${r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}`] },
            { key: 'siteId', label: 'Site', render: (r) => siteNames[r.siteId] ?? '—' },
            { key: 'quantity', label: 'Litres', align: 'right', render: (r) => formatLitres(r.quantity) },
            { key: 'ratePerLitre', label: 'Rate / L', align: 'right', render: (r) => formatCurrency(r.ratePerLitre) },
            { key: 'totalCost', label: 'Total cost', align: 'right', render: (r) => formatCurrency(r.totalCost) },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">AdBlue Filling Records</h1>
          <p className="mt-1 text-steel-500">AdBlue filled into each vehicle and machine from site stock.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="ADBLUE" action="CREATE">
            <Button as={Link} to="/adblue/fillings/new">
              Record filling
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Input
          placeholder="Search asset ID, RCPL or registration no..."
          title="Search by asset ID, machinery RCPL or vehicle registration number"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)}>
          <option value="">All asset types</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
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
          !error && <Spinner label="Loading AdBlue fillings" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No AdBlue fillings match these filters."
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
        title="Delete this AdBlue filling?"
        description={
          deleteTarget
            ? `${formatLitres(deleteTarget.quantity)} for ${deleteTarget.assetLabel ?? deleteTarget.assetId} on ${formatDateOnly(deleteTarget.fillingDate)}. These litres go back into site stock.`
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
