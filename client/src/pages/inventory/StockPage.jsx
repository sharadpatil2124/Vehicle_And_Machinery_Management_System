import { useEffect, useMemo, useState } from 'react';
import { stockApi, itemsApi, storageLocationsApi, sitesApi } from '../../api/client';
import { Alert, Badge, Select, Spinner, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';

const TABS = [
  { value: 'balances', label: 'Stock Balances' },
  { value: 'transactions', label: 'Transaction History' },
];

const TRANSACTION_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'PURCHASE_RECEIPT', label: 'Purchase receipt' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'ISSUE_REVERSAL', label: 'Issue reversal' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'TRANSFER_OUT', label: 'Transfer out' },
  { value: 'TRANSFER_IN', label: 'Transfer in' },
];

function stockStatus(balance) {
  const quantity = balance.availableQuantity;
  const { minimumStockLevel, reorderLevel } = balance;
  if (minimumStockLevel != null && quantity <= minimumStockLevel) return { tone: 'danger', label: 'Low stock' };
  if (reorderLevel != null && quantity <= reorderLevel) return { tone: 'warning', label: 'Reorder' };
  if (minimumStockLevel != null || reorderLevel != null) return { tone: 'success', label: 'Healthy' };
  return { tone: 'neutral', label: 'No threshold set' };
}

function StockStatusBadge({ balance }) {
  const { tone, label } = stockStatus(balance);
  return <Badge tone={tone}>{label}</Badge>;
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'bg-brand-600 text-white' : 'text-steel-600 hover:bg-steel-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function StockPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [tab, setTab] = useState('balances');
  const [filters, setFilters] = useState({ siteId: '', itemId: '', storageLocationId: '', transactionType: '' });
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [balances, setBalances] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);
  const siteNames = useSiteNames();

  useEffect(() => {
    itemsApi.list({ limit: 100 }).then((r) => setItems(r.data)).catch(() => setItems([]));
    storageLocationsApi.list({ limit: 100 }).then((r) => setStorageLocations(r.data)).catch(() => setStorageLocations([]));
    if (isAdmin) sitesApi.list({ limit: 100 }).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, [isAdmin]);

  useEffect(() => {
    setError(null);
    const params = {
      itemId: filters.itemId || undefined,
      storageLocationId: filters.storageLocationId || undefined,
      limit: 100,
    };
    if (tab === 'balances') {
      stockApi.balances(params).then((r) => setBalances(r.data)).catch((err) => setError(err.message));
    } else {
      stockApi
        .transactions({ ...params, transactionType: filters.transactionType || undefined })
        .then((r) => setTransactions(r.data))
        .catch((err) => setError(err.message));
    }
  }, [tab, filters]);

  const locationOptions = useMemo(
    () => (isAdmin && filters.siteId ? storageLocations.filter((l) => String(l.siteId) === filters.siteId) : storageLocations),
    [storageLocations, isAdmin, filters.siteId]
  );

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const balanceColumns = [
    { key: 'itemName', label: 'Item' },
    { key: 'availableQuantity', label: 'Available' },
    { key: 'siteId', label: 'Site', render: (b) => siteNames[b.siteId] ?? '—' },
    { key: 'locationName', label: 'Storage location' },
    { key: 'status', label: 'Status', render: (b) => <StockStatusBadge balance={b} /> },
    { key: 'averageUnitCost', label: 'Avg. unit cost' },
    {
      key: 'lastTransactionAt',
      label: 'Last movement',
      render: (b) => (b.lastTransactionAt ? new Date(b.lastTransactionAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    },
  ];

  const transactionColumns = [
    {
      key: 'transactionAt',
      label: 'Date',
      render: (t) => new Date(t.transactionAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    { key: 'transactionNumber', label: 'Reference' },
    {
      key: 'transactionType',
      label: 'Type',
      render: (t) => (
        <Badge tone={t.transactionType.includes('OUT') || t.transactionType === 'ISSUE' ? 'warning' : 'success'}>
          {t.transactionType.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    { key: 'itemName', label: 'Item' },
    { key: 'siteId', label: 'Site', render: (t) => siteNames[t.siteId] ?? '—' },
    { key: 'locationName', label: 'Storage location' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'unitCost', label: 'Unit cost' },
    { key: 'totalCost', label: 'Total cost' },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Stock</h1>
        <p className="mt-1 text-steel-500">
          {isAdmin ? 'Current stock and the full movement ledger, across every site.' : 'Current stock and the full movement ledger at your site.'}
        </p>
      </div>

      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <TabButton key={t.value} active={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={`mb-4 grid gap-3 ${isAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value, storageLocationId: '' }))}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={filters.itemId} onChange={(e) => updateFilter('itemId', e.target.value)}>
          <option value="">All items</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.itemName}
            </option>
          ))}
        </Select>
        <Select value={filters.storageLocationId} onChange={(e) => updateFilter('storageLocationId', e.target.value)}>
          <option value="">All storage locations</option>
          {locationOptions.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.locationName}
            </option>
          ))}
        </Select>
        {tab === 'transactions' && (
          <Select value={filters.transactionType} onChange={(e) => updateFilter('transactionType', e.target.value)}>
            {TRANSACTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {tab === 'balances' ? (
          !balances ? (
            <Spinner label="Loading stock balances" />
          ) : (
            <Table columns={balanceColumns} rows={balances} getRowKey={(b) => b.id} emptyMessage="No stock on hand matches these filters." />
          )
        ) : !transactions ? (
          <Spinner label="Loading transaction history" />
        ) : (
          <Table columns={transactionColumns} rows={transactions} getRowKey={(t) => t.id} emptyMessage="No transactions match these filters." />
        )}
      </div>
    </div>
  );
}
