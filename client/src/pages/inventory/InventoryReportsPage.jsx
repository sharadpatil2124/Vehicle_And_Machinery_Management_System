import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryReportsApi } from '../../api/client';
import { Alert, Input, Pagination, Select, Spinner, Table, Tabs } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { firstOfMonthDateOnly, formatCurrency, formatDateOnly, formatNumber, todayDateOnly } from '../../config/fuel';

const TABS = [
  { value: 'register', label: 'Stock register' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'assets', label: 'Parts by asset' },
];

const PAGE_SIZE = 10;
const muted = <span className="text-steel-300">—</span>;
const money = (v) => <span className="tabular-nums">{formatCurrency(v)}</span>;

function signedCurrency(value) {
  if (!value) return formatCurrency(0);
  return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

function Summary({ items }) {
  return (
    <dl className="mb-4 grid gap-4 rounded border border-steel-200 bg-white px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
          {hint && <dd className="text-xs text-steel-500">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Pair({ amount, uom, signed = false, strong = false }) {
  if (signed && amount.quantity === 0 && amount.value === 0) return muted;
  const sign = signed && amount.quantity > 0 ? '+' : '';
  return (
    <div className={`flex flex-col items-end tabular-nums ${strong ? 'font-semibold text-steel-900' : ''}`}>
      <span>
        {sign}
        {formatNumber(amount.quantity, 3)} {uom}
      </span>
      <span className={`text-xs ${strong ? 'text-steel-700' : 'text-steel-500'}`}>{signed ? signedCurrency(amount.value) : formatCurrency(amount.value)}</span>
    </div>
  );
}

function ItemName({ name, code }) {
  return (
    <div className="flex min-w-40 flex-col">
      <span className="font-semibold text-steel-900">{name}</span>
      {code && <span className="text-xs text-steel-500">{code}</span>}
    </div>
  );
}

function ReportSection({ title, noun, rows, columns, searchText, defaultSort, emptyMessage }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const filtered = term ? rows.filter((r) => searchText(r).toLowerCase().includes(term)) : rows;
  const sortColumn = columns.find((c) => c.key === sort.field);
  const sorted = [...filtered].sort((a, b) => {
    const left = sortColumn.sortValue(a);
    const right = sortColumn.sortValue(b);
    const order = typeof left === 'string' ? left.localeCompare(right) : left - right;
    return sort.direction === 'asc' ? order : -order;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(field) {
    const isText = typeof columns.find((c) => c.key === field).sortValue(rows[0] ?? {}) === 'string';
    setSort((s) => ({ field, direction: s.field === field ? (s.direction === 'desc' ? 'asc' : 'desc') : isText ? 'asc' : 'desc' }));
    setPage(1);
  }

  return (
    <section className="rounded border border-steel-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-steel-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-steel-900">{title}</h2>
          <p className="text-xs text-steel-500">
            {rows.length} {rows.length === 1 ? noun : `${noun}s`}
          </p>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="sm:w-64">
            <Input
              placeholder={`Search ${noun}s...`}
              aria-label={`Search ${noun}s`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
      </header>
      <Table
        columns={columns}
        rows={visible}
        getRowKey={(r) => `${noun}-${r.key ?? r.itemId ?? `${r.assetType}-${r.assetId}`}`}
        sort={sort}
        onSort={handleSort}
        emptyMessage={term ? `No ${noun}s match "${search.trim()}".` : emptyMessage}
      />
      {sorted.length > PAGE_SIZE && <Pagination page={currentPage} pages={pages} total={sorted.length} onPageChange={setPage} />}
    </section>
  );
}

function RegisterReport({ data }) {
  const t = data.totals;
  const columns = [
    { key: 'item', label: 'Item', sortable: true, wrap: true, sortValue: (r) => r.itemName ?? '', render: (r) => <ItemName name={r.itemName} code={r.itemCode} /> },
    { key: 'opening', label: 'Opening', sortable: true, align: 'right', sortValue: (r) => r.opening.value, render: (r) => <Pair amount={r.opening} uom={r.uom} /> },
    { key: 'purchased', label: 'Purchased', sortable: true, align: 'right', sortValue: (r) => r.purchased.value, render: (r) => <Pair amount={r.purchased} uom={r.uom} /> },
    { key: 'used', label: 'Used', sortable: true, align: 'right', sortValue: (r) => r.used.value, render: (r) => <Pair amount={r.used} uom={r.uom} /> },
    { key: 'adjusted', label: 'Adjusted', sortable: true, align: 'right', sortValue: (r) => r.adjusted.value, render: (r) => <Pair amount={r.adjusted} uom={r.uom} signed /> },
    { key: 'transfers', label: 'Transfers', sortable: true, align: 'right', sortValue: (r) => r.transfers.value, render: (r) => <Pair amount={r.transfers} uom={r.uom} signed /> },
    { key: 'closing', label: 'Closing', sortable: true, align: 'right', sortValue: (r) => r.closing.value, render: (r) => <Pair amount={r.closing} uom={r.uom} strong /> },
    {
      key: 'closingUnitCost',
      label: 'Avg. cost / unit',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.closingUnitCost ?? 0,
      render: (r) => (r.closingUnitCost == null ? muted : money(r.closingUnitCost)),
    },
  ];

  return (
    <>
      <Summary
        items={[
          ['Opening stock value', formatCurrency(t.opening), `At start of ${formatDateOnly(data.dateFrom)}`],
          ['Purchased', formatCurrency(t.purchased), 'Received into stock'],
          ['Used', formatCurrency(t.used), 'Issued to assets, less returns'],
          ['Closing stock value', formatCurrency(t.closing), `At end of ${formatDateOnly(data.dateTo)}`],
        ]}
      />
      <ReportSection
        title="Stock by item"
        noun="item"
        rows={data.rows}
        columns={columns}
        searchText={(r) => `${r.itemName} ${r.itemCode}`}
        defaultSort={{ field: 'closing', direction: 'desc' }}
        emptyMessage="No stock or movements in this period."
      />
    </>
  );
}

function PurchaseReport({ data }) {
  const t = data.totals;
  const supplierColumns = [
    { key: 'label', label: 'Supplier', sortable: true, wrap: true, sortValue: (r) => r.label ?? '', render: (r) => <span className="font-semibold text-steel-900">{r.label}</span> },
    { key: 'purchases', label: 'Purchases', sortable: true, align: 'right', sortValue: (r) => r.purchases, render: (r) => <span className="tabular-nums">{r.purchases}</span> },
    { key: 'beforeTax', label: 'Before tax', sortable: true, align: 'right', sortValue: (r) => r.beforeTax, render: (r) => money(r.beforeTax) },
    { key: 'tax', label: 'Tax', sortable: true, align: 'right', sortValue: (r) => r.tax, render: (r) => money(r.tax) },
    { key: 'total', label: 'Total (incl. tax)', sortable: true, align: 'right', sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{money(r.total)}</span> },
  ];
  const itemColumns = [
    { key: 'label', label: 'Item', sortable: true, wrap: true, sortValue: (r) => r.label ?? '', render: (r) => <ItemName name={r.label} code={r.itemCode} /> },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.quantity,
      render: (r) => (
        <span className="tabular-nums">
          {formatNumber(r.quantity, 3)} {r.uom}
        </span>
      ),
    },
    {
      key: 'averageUnitCost',
      label: 'Avg. price / unit',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.averageUnitCost ?? 0,
      render: (r) => (
        <div className="flex flex-col items-end tabular-nums">
          <span>{formatCurrency(r.averageUnitCost)}</span>
          {r.low !== r.high && (
            <span className="text-xs text-steel-500">
              {formatCurrency(r.low)} – {formatCurrency(r.high)}
            </span>
          )}
        </div>
      ),
    },
    { key: 'tax', label: 'Tax', sortable: true, align: 'right', sortValue: (r) => r.tax, render: (r) => money(r.tax) },
    { key: 'total', label: 'Total (incl. tax)', sortable: true, align: 'right', sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{money(r.total)}</span> },
  ];

  return (
    <>
      <Summary
        items={[
          ['Purchases received', String(t.purchases)],
          ['Before tax', formatCurrency(t.beforeTax)],
          ['Tax', formatCurrency(t.tax)],
          ['Total cost', formatCurrency(t.total), 'Including tax'],
        ]}
      />
      <div className="flex flex-col gap-5">
        <ReportSection
          title="By supplier"
          noun="supplier"
          rows={data.bySupplier}
          columns={supplierColumns}
          searchText={(r) => r.label ?? ''}
          defaultSort={{ field: 'total', direction: 'desc' }}
          emptyMessage="No purchases received in this period."
        />
        <ReportSection
          title="By item"
          noun="item"
          rows={data.byItem}
          columns={itemColumns}
          searchText={(r) => `${r.label} ${r.itemCode}`}
          defaultSort={{ field: 'total', direction: 'desc' }}
          emptyMessage="No purchases received in this period."
        />
      </div>
    </>
  );
}

function AssetReport({ data }) {
  const t = data.totals;
  const columns = [
    {
      key: 'asset',
      label: 'Asset',
      sortable: true,
      wrap: true,
      sortValue: (r) => r.assetLabel ?? r.assetId,
      render: (r) => {
        const path = r.assetRecordId ? `/${r.assetType === 'VEHICLE' ? 'vehicles' : 'machinery'}/${r.assetRecordId}` : null;
        const label = r.assetLabel ?? r.assetId;
        return (
          <div className="flex min-w-40 flex-col">
            {path ? (
              <Link to={path} className="font-semibold text-brand-600 hover:underline">
                {label}
              </Link>
            ) : (
              <span className="font-semibold text-steel-900">{label}</span>
            )}
            <span className="text-xs text-steel-500">
              {r.assetId} · {r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
            </span>
          </div>
        );
      },
    },
    { key: 'issues', label: 'Issues', sortable: true, align: 'right', sortValue: (r) => r.issues, render: (r) => <span className="tabular-nums">{r.issues}</span> },
    { key: 'issuedValue', label: 'Issued', sortable: true, align: 'right', sortValue: (r) => r.issuedValue, render: (r) => money(r.issuedValue) },
    {
      key: 'returnedValue',
      label: 'Returned',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.returnedValue,
      render: (r) => (r.returnedValue > 0 ? <span className="tabular-nums">−{formatCurrency(r.returnedValue)}</span> : muted),
    },
    { key: 'netCost', label: 'Parts cost', sortable: true, align: 'right', sortValue: (r) => r.netCost, render: (r) => <span className="font-semibold">{money(r.netCost)}</span> },
  ];

  return (
    <>
      <Summary
        items={[
          ['Assets', String(t.assets)],
          ['Issues', String(t.issues)],
          ['Returned to stock', formatCurrency(t.returnedValue)],
          ['Total parts cost', formatCurrency(t.netCost), 'Issued, less returns'],
        ]}
      />
      <ReportSection
        title="Parts cost by vehicle and machine"
        noun="asset"
        rows={data.rows}
        columns={columns}
        searchText={(r) => `${r.assetLabel ?? ''} ${r.assetId}`}
        defaultSort={{ field: 'netCost', direction: 'desc' }}
        emptyMessage="No parts issued in this period."
      />
    </>
  );
}

const LOADERS = {
  register: inventoryReportsApi.stockRegister,
  purchases: inventoryReportsApi.purchases,
  assets: inventoryReportsApi.partsByAsset,
};

export default function InventoryReportsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [tab, setTab] = useState('register');
  const [filters, setFilters] = useState({ dateFrom: firstOfMonthDateOnly(), dateTo: todayDateOnly(), siteId: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    LOADERS[tab]({ dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, siteId: filters.siteId || undefined })
      .then((r) => {
        if (!cancelled) setData({ tab, report: r.data });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Inventory Reports</h1>
        <p className="mt-1 text-steel-500">Stock value, purchase cost and parts cost for any period.</p>
      </div>

      <div className="mb-4 grid gap-3 sm:max-w-2xl sm:grid-cols-3">
        <Input
          type="date"
          aria-label="From date"
          title="From date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="To date"
          title="To date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          max={todayDateOnly()}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
        />
        {isAdmin && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value }))}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Alert tone="error">{error}</Alert>
      {data?.tab !== tab && !error && <Spinner label="Loading report" />}
      {data?.tab === tab && tab === 'register' && <RegisterReport data={data.report} />}
      {data?.tab === tab && tab === 'purchases' && <PurchaseReport data={data.report} />}
      {data?.tab === tab && tab === 'assets' && <AssetReport data={data.report} />}
    </div>
  );
}
