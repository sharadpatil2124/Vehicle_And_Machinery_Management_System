import { useEffect, useState } from 'react';
import { siteFuelStockApi } from '../../api/client';
import { Alert, Badge, Input, Pagination, Select, Spinner, Table, Tabs } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { ENTRY_TYPE, STORABLE_FUEL_TYPES, formatCurrency, formatDateOnly, formatLitres } from '../../config/fuel';

const TABS = [
  { value: 'stock', label: 'Stock by site' },
  { value: 'movements', label: 'Movements' },
];

function SiteFilter({ isAdmin, siteNames, value, onChange }) {
  if (!isAdmin) return null;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All sites</option>
      {Object.entries(siteNames).map(([siteId, name]) => (
        <option key={siteId} value={siteId}>
          {name}
        </option>
      ))}
    </Select>
  );
}

function FuelTypeFilter({ value, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All fuel types</option>
      {STORABLE_FUEL_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </Select>
  );
}

function StockTab({ isAdmin, siteNames }) {
  const [filters, setFilters] = useState({ siteId: '', fuelType: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);
    siteFuelStockApi
      .list({ siteId: filters.siteId || undefined, fuelType: filters.fuelType || undefined })
      .then((r) => !cancelled && setRows(r.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const columns = [
    { key: 'siteName', label: 'Site' },
    { key: 'fuelType', label: 'Fuel' },
    {
      key: 'quantityOnHand',
      label: 'On hand',
      render: (r) => (
        <span className={`font-semibold tabular-nums ${r.quantityOnHand > 0 ? 'text-steel-900' : 'text-steel-400'}`}>{formatLitres(r.quantityOnHand)}</span>
      ),
    },
    {
      key: 'inTransitQuantity',
      label: 'In transit',
      render: (r) =>
        r.inTransitQuantity > 0 ? (
          <span className="tabular-nums text-warning-600">
            {formatLitres(r.inTransitQuantity)} · {r.inTransitCollections} {r.inTransitCollections === 1 ? 'trip' : 'trips'}
          </span>
        ) : (
          <span className="text-steel-400">—</span>
        ),
    },
    { key: 'averageCost', label: 'Avg. cost / L', render: (r) => <span className="tabular-nums">{r.quantityOnHand > 0 ? formatCurrency(r.averageCost) : '—'}</span> },
    { key: 'stockValue', label: 'Stock value', render: (r) => <span className="tabular-nums">{formatCurrency(r.stockValue)}</span> },
    {
      key: 'lastMovementAt',
      label: 'Last movement',
      render: (r) => (r.lastMovementAt ? new Date(r.lastMovementAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    },
  ];

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:max-w-md sm:grid-cols-2">
        <SiteFilter isAdmin={isAdmin} siteNames={siteNames} value={filters.siteId} onChange={(siteId) => setFilters((f) => ({ ...f, siteId }))} />
        <FuelTypeFilter value={filters.fuelType} onChange={(fuelType) => setFilters((f) => ({ ...f, fuelType }))} />
      </div>
      <Alert tone="error">{error}</Alert>
      <div className="rounded border border-steel-200 bg-white">
        {!rows ? (
          <Spinner label="Loading fuel stock" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            getRowKey={(r) => `${r.siteId}-${r.fuelType}`}
            emptyMessage="No fuel stock yet. Stock appears once a fuel collection is received at a site."
          />
        )}
      </div>
    </div>
  );
}

function MovementsTab({ isAdmin, siteNames }) {
  const [filters, setFilters] = useState({ siteId: '', fuelType: '', entryType: '', dateFrom: '', dateTo: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    siteFuelStockApi
      .ledger({
        siteId: filters.siteId || undefined,
        fuelType: filters.fuelType || undefined,
        entryType: filters.entryType || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: filters.page,
      })
      .then((r) => !cancelled && setResult(r))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const update = (key) => (value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const columns = [
    { key: 'entryDate', label: 'Date', render: (e) => formatDateOnly(e.entryDate) },
    { key: 'siteName', label: 'Site' },
    { key: 'fuelType', label: 'Fuel' },
    { key: 'entryType', label: 'Type', render: (e) => <Badge tone={ENTRY_TYPE[e.entryType]?.tone}>{ENTRY_TYPE[e.entryType]?.label ?? e.entryType}</Badge> },
    { key: 'referenceLabel', label: 'Reference', render: (e) => e.referenceLabel ?? '—' },
    { key: 'in', label: 'In', render: (e) => (e.direction === 'IN' ? <span className="tabular-nums text-success-600">+{formatLitres(e.quantity)}</span> : '') },
    { key: 'out', label: 'Out', render: (e) => (e.direction === 'OUT' ? <span className="tabular-nums text-danger-600">−{formatLitres(e.quantity)}</span> : '') },
    { key: 'unitCost', label: 'Cost / L', render: (e) => <span className="tabular-nums">{formatCurrency(e.unitCost)}</span> },
    { key: 'totalCost', label: 'Value', render: (e) => <span className="tabular-nums">{formatCurrency(e.totalCost)}</span> },
    { key: 'balanceQuantity', label: 'Balance', render: (e) => <span className="font-semibold tabular-nums">{formatLitres(e.balanceQuantity)}</span> },
  ];

  return (
    <div>
      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <SiteFilter isAdmin={isAdmin} siteNames={siteNames} value={filters.siteId} onChange={update('siteId')} />
        <FuelTypeFilter value={filters.fuelType} onChange={update('fuelType')} />
        <Select value={filters.entryType} onChange={(e) => update('entryType')(e.target.value)}>
          <option value="">All movement types</option>
          {Object.entries(ENTRY_TYPE).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} onChange={(e) => update('dateFrom')(e.target.value)} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} onChange={(e) => update('dateTo')(e.target.value)} />
      </div>
      <p className="mb-3 text-xs text-steel-500">Newest recorded first. Balance is the stock right after each movement was recorded.</p>
      <Alert tone="error">{error}</Alert>
      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          <Spinner label="Loading movements" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(e) => e.id} emptyMessage="No stock movements match these filters." />
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

export default function FuelStockPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [tab, setTab] = useState('stock');

  return (
    <div>
      <div className="mb-5">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Fuel Stock</h1>
          <p className="mt-1 text-steel-500">
            {isAdmin ? 'Fuel on hand at every site, and every movement in and out.' : 'Fuel on hand at your site, and every movement in and out.'}
          </p>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'stock' && <StockTab isAdmin={isAdmin} siteNames={siteNames} />}
      {tab === 'movements' && <MovementsTab isAdmin={isAdmin} siteNames={siteNames} />}
    </div>
  );
}
