import { useEffect, useMemo, useState } from 'react';
import { stockApi, itemsApi, storageLocationsApi, sitesApi } from '../../api/client';
import { Alert, Badge, Button, Modal, Select, Spinner, Table } from '../../components/ui';
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

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const money = (value) => currencyFormatter.format(Number(value));
const qty = (value) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const BIG_PRICE_JUMP = 0.1;
const INLINE_BATCH_LIMIT = 3;

const BATCH_SOURCE_LABEL = {
  OPENING_BALANCE: 'Opening stock',
  PURCHASE_RECEIPT: 'Purchase',
  ISSUE_REVERSAL: 'Returned from issue',
  ADJUSTMENT: 'Stock check',
  TRANSFER_IN: 'Transfer in',
};

function LatestPrice({ balance }) {
  const { latestUnitCost: latest, previousUnitCost: previous } = balance;
  if (latest == null) return <span className="text-steel-400">—</span>;
  if (previous == null) return <span className="font-semibold text-steel-900 tabular-nums">{money(latest)}</span>;

  const rose = latest > previous;
  const bigJump = rose && previous > 0 && (latest - previous) / previous > BIG_PRICE_JUMP;
  return (
    <div className="flex flex-col tabular-nums">
      <span className="font-semibold text-steel-900">{money(latest)}</span>
      <span className={`text-xs ${bigJump ? 'font-semibold text-warning-600' : 'text-steel-500'}`}>
        {rose ? '▲' : '▼'} was {money(previous)}
      </span>
    </div>
  );
}

function groupNeighboursByPrice(batches) {
  const groups = [];
  for (const batch of batches) {
    const last = groups[groups.length - 1];
    if (last && last.unitCost === batch.unitCost) {
      last.remainingQuantity = Math.round((last.remainingQuantity + batch.remainingQuantity) * 1000) / 1000;
    } else {
      groups.push({ key: batch.id, unitCost: batch.unitCost, remainingQuantity: batch.remainingQuantity });
    }
  }
  return groups;
}

function BoughtAt({ balance, onShowBatches }) {
  const batches = balance.batches ?? [];
  if (batches.length === 0) return <span className="text-steel-400">—</span>;

  const groups = groupNeighboursByPrice(batches);
  const hidden = groups.length - INLINE_BATCH_LIMIT;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.slice(0, INLINE_BATCH_LIMIT).map((group) => (
        <span key={group.key} className="rounded bg-steel-100 px-1.5 py-0.5 text-xs whitespace-nowrap text-steel-700 tabular-nums">
          {money(group.unitCost)} ({qty(group.remainingQuantity)})
        </span>
      ))}
      {batches.length > 1 && (
        <button type="button" onClick={() => onShowBatches(balance)} className="text-xs font-semibold text-brand-600 hover:underline">
          {hidden > 0 ? `+${hidden} more` : 'Details'}
        </button>
      )}
    </div>
  );
}

function BatchesModal({ balance, siteName, onClose }) {
  const batches = balance?.batches ?? [];
  const columns = [
    {
      key: 'receivedAt',
      label: 'Bought on',
      render: (b) => new Date(b.receivedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    },
    { key: 'sourceType', label: 'Source', render: (b) => BATCH_SOURCE_LABEL[b.sourceType] ?? b.sourceType },
    { key: 'unitCost', label: 'Price', render: (b) => <span className="tabular-nums">{money(b.unitCost)}</span> },
    { key: 'remainingQuantity', label: 'In stock', render: (b) => <span className="tabular-nums">{qty(b.remainingQuantity)}</span> },
    {
      key: 'value',
      label: 'Value',
      render: (b) => <span className="tabular-nums">{money(b.remainingQuantity * b.unitCost)}</span>,
    },
  ];

  return (
    <Modal
      wide
      open={balance !== null}
      onClose={onClose}
      title={balance ? `${balance.itemName} — prices in stock` : ''}
      description={
        balance
          ? `${siteName ?? ''}${balance.locationName ? ` · ${balance.locationName}` : ''}. Prices include tax. The oldest batch is used first when stock goes out.`
          : undefined
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Table columns={columns} rows={batches} getRowKey={(b) => b.id} />
      {balance && (
        <p className="mt-3 text-sm font-semibold text-steel-900 tabular-nums">
          Total: {qty(balance.availableQuantity)} units · {money(balance.stockValue)}
        </p>
      )}
    </Modal>
  );
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
  const [batchesFor, setBatchesFor] = useState(null);
  const siteNames = useSiteNames();

  useEffect(() => {
    itemsApi.list({ limit: 100 }).then((r) => setItems(r.data)).catch(() => setItems([]));
    storageLocationsApi.list({ limit: 100 }).then((r) => setStorageLocations(r.data)).catch(() => setStorageLocations([]));
    if (isAdmin) sitesApi.list({ limit: 100 }).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = {
      siteId: isAdmin ? filters.siteId || undefined : undefined,
      itemId: filters.itemId || undefined,
      storageLocationId: filters.storageLocationId || undefined,
      limit: 100,
    };
    if (tab === 'balances') {
      setBalances(null);
      stockApi
        .balances(params)
        .then((r) => !cancelled && setBalances(r.data))
        .catch((err) => !cancelled && setError(err.message));
    } else {
      setTransactions(null);
      stockApi
        .transactions({ ...params, transactionType: filters.transactionType || undefined })
        .then((r) => !cancelled && setTransactions(r.data))
        .catch((err) => !cancelled && setError(err.message));
    }
    return () => {
      cancelled = true;
    };
  }, [tab, filters, isAdmin]);

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
    { key: 'latestUnitCost', label: 'Latest price', render: (b) => <LatestPrice balance={b} /> },
    { key: 'batches', label: 'Bought at', render: (b) => <BoughtAt balance={b} onShowBatches={setBatchesFor} /> },
    { key: 'stockValue', label: 'Stock value', render: (b) => <span className="tabular-nums">{money(b.stockValue ?? 0)}</span> },
    {
      key: 'lastTransactionAt',
      label: 'Last movement',
      render: (b) => (b.lastTransactionAt ? new Date(b.lastTransactionAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    },
  ];

  const transactionColumns = [
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
    { key: 'unitCost', label: 'Unit cost (incl. tax)' },
    { key: 'totalCost', label: 'Total cost (incl. tax)' },
    {
      key: 'transactionAt',
      label: 'Date',
      render: (t) => new Date(t.transactionAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Stock</h1>
        <p className="mt-1 text-steel-500">
          {isAdmin ? 'Current stock and the full movement ledger, across every site.' : 'Current stock and the full movement ledger at your site.'}{' '}
          All prices, costs and values include tax.
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

      <BatchesModal balance={batchesFor} siteName={batchesFor ? siteNames[batchesFor.siteId] : null} onClose={() => setBatchesFor(null)} />
    </div>
  );
}
