import { useEffect, useState } from 'react';
import { fuelReportsApi } from '../../api/client';
import { Alert, Input, Select, Spinner, Tabs } from '../../components/ui';
import ReportTable from '../../components/ReportTable';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { firstOfMonthDateOnly, formatCurrency, formatLitres, todayDateOnly } from '../../config/fuel';

const TABS = [
  { value: 'register', label: 'Site fuel register' },
  { value: 'assets', label: 'Fuel by asset' },
  { value: 'collections', label: 'Collections' },
];

const qty = (v) => <span className="tabular-nums">{formatLitres(v)}</span>;
const money = (v) => <span className="tabular-nums">{formatCurrency(v)}</span>;

function Pair({ amount }) {
  return (
    <div className="flex flex-col tabular-nums">
      <span>{formatLitres(amount.quantity)}</span>
      <span className="text-xs text-steel-500">{formatCurrency(amount.value)}</span>
    </div>
  );
}

function Summary({ items }) {
  return (
    <dl className="mb-4 grid gap-4 rounded border border-steel-200 bg-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, tone, detail]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? 'text-steel-900'}`}>{value}</dd>
          {detail && <dd className="mt-0.5 text-xs text-steel-500 tabular-nums">{detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

function RegisterReport({ data }) {
  const columns = [
    { key: 'siteName', label: 'Site', sortable: true, sortValue: (r) => r.siteName ?? '' },
    { key: 'fuelType', label: 'Fuel', sortable: true, sortValue: (r) => r.fuelType ?? '' },
    { key: 'opening', label: 'Opening', sortable: true, sortValue: (r) => r.opening.value, render: (r) => <Pair amount={r.opening} /> },
    { key: 'received', label: 'Received', sortable: true, sortValue: (r) => r.received.value, render: (r) => <Pair amount={r.received} /> },
    { key: 'issued', label: 'Issued', sortable: true, sortValue: (r) => r.issued.value, render: (r) => <Pair amount={r.issued} /> },
    {
      key: 'closing',
      label: 'Closing',
      sortable: true,
      sortValue: (r) => r.closing.value,
      render: (r) => (
        <span className="font-semibold">
          <Pair amount={r.closing} />
        </span>
      ),
    },
    {
      key: 'transitLoss',
      label: 'Transit loss',
      sortable: true,
      sortValue: (r) => r.transitLoss.value,
      render: (r) =>
        r.transitLoss.quantity > 0 ? (
          <span className="text-danger-600">
            <Pair amount={r.transitLoss} />
          </span>
        ) : (
          <span className="text-steel-400">—</span>
        ),
    },
    { key: 'inTransitNow', label: 'In transit now', sortable: true, sortValue: (r) => r.inTransitNow, render: (r) => (r.inTransitNow > 0 ? qty(r.inTransitNow) : <span className="text-steel-400">—</span>) },
    {
      key: 'directPump',
      label: 'Direct at pump',
      sortable: true,
      sortValue: (r) => r.directPump.value,
      render: (r) => (r.directPump.fills > 0 ? <Pair amount={r.directPump} /> : <span className="text-steel-400">—</span>),
    },
  ];

  const sum = (pick) => data.rows.reduce((t, r) => t + pick(r), 0);
  const collected = sum((r) => r.collected.amount);
  const issuedFromStock = sum((r) => r.issued.value);
  const atPump = sum((r) => r.directPump.value);

  return (
    <>
      <Summary
        items={[
          ['Fuel bought', formatCurrency(collected + atPump), null, `Collections ${formatCurrency(collected)} · At pump ${formatCurrency(atPump)}`],
          ['Fuel issued', formatCurrency(issuedFromStock + atPump), null, `Site stock ${formatCurrency(issuedFromStock)} · At pump ${formatCurrency(atPump)}`],
          ['Transit loss', formatCurrency(sum((r) => r.transitLoss.value)), 'text-danger-600'],
          ['Closing stock value', formatCurrency(sum((r) => r.closing.value))],
        ]}
      />
      <ReportTable
        noun="site"
        rows={data.rows}
        columns={columns}
        getRowKey={(r) => `${r.siteId}-${r.fuelType}`}
        searchText={(r) => `${r.siteName ?? ''} ${r.fuelType ?? ''}`}
        subtitle={() => `${data.rows.length} ${data.rows.length === 1 ? 'row' : 'rows'} (site and fuel type)`}
        emptyMessage="No fuel movements in this period."
      />
    </>
  );
}

function AssetReport({ data }) {
  const columns = [
    {
      key: 'asset',
      label: 'Asset',
      sortable: true,
      sortValue: (r) => r.assetLabel ?? r.assetId,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.assetLabel ?? r.assetId}</span>
          <span className="text-xs text-steel-500">
            {r.assetId} · {r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
          </span>
        </div>
      ),
    },
    { key: 'entryCount', label: 'Fills', sortable: true, sortValue: (r) => r.entryCount },
    { key: 'totalLitres', label: 'Litres', sortable: true, sortValue: (r) => r.totalLitres, render: (r) => qty(r.totalLitres) },
    { key: 'siteStockLitres', label: 'From site stock', sortable: true, sortValue: (r) => r.siteStockLitres, render: (r) => qty(r.siteStockLitres) },
    { key: 'directPumpLitres', label: 'Direct at pump', sortable: true, sortValue: (r) => r.directPumpLitres, render: (r) => qty(r.directPumpLitres) },
    { key: 'totalCost', label: 'Cost', sortable: true, sortValue: (r) => r.totalCost, render: (r) => <span className="font-semibold">{money(r.totalCost)}</span> },
  ];

  return (
    <>
      <Summary
        items={[
          ['Assets fuelled', String(data.rows.length)],
          ['Total litres', formatLitres(data.totals.litres)],
          ['Total fuel cost', formatCurrency(data.totals.cost)],
        ]}
      />
      <ReportTable
        noun="asset"
        rows={data.rows}
        columns={columns}
        getRowKey={(r) => `${r.assetType}-${r.assetId}-${r.meterType}`}
        searchText={(r) => `${r.assetLabel ?? ''} ${r.assetId}`}
        emptyMessage="No fuel issued in this period."
      />
    </>
  );
}

function splitCarrierLabel(label) {
  const match = /^(.*) \(([^()]+)\)$/.exec(label ?? '');
  return match ? { primary: match[1], secondary: match[2] } : { primary: label ?? '—', secondary: null };
}

function CollectionBreakdown({ title, noun, nameHeading, rows, splitName = false }) {
  const muted = <span className="text-steel-400">—</span>;
  const columns = [
    {
      key: 'label',
      label: nameHeading,
      sortable: true,
      wrap: true,
      sortValue: (r) => (r.label ?? '').toLowerCase(),
      render: (r) => {
        const { primary, secondary } = splitName ? splitCarrierLabel(r.label) : { primary: r.label ?? '—', secondary: null };
        return (
          <div className="flex min-w-48 flex-col">
            <span className="font-semibold wrap-break-word text-steel-900">{primary}</span>
            {secondary && <span className="text-xs text-steel-500">{secondary}</span>}
          </div>
        );
      },
    },
    { key: 'trips', label: 'Trips', sortable: true, sortValue: (r) => r.trips, align: 'right', render: (r) => <span className="tabular-nums">{r.trips}</span> },
    { key: 'collectedQuantity', label: 'Collected', sortable: true, sortValue: (r) => r.collectedQuantity, align: 'right', render: (r) => qty(r.collectedQuantity) },
    { key: 'receivedQuantity', label: 'Received', sortable: true, sortValue: (r) => r.receivedQuantity, align: 'right', render: (r) => qty(r.receivedQuantity) },
    {
      key: 'shortageQuantity',
      label: 'Transit loss',
      sortable: true,
      sortValue: (r) => r.shortageQuantity,
      align: 'right',
      render: (r) =>
        r.shortageQuantity > 0 ? (
          <div className="flex flex-col tabular-nums text-danger-600">
            <span>{formatLitres(r.shortageQuantity)}</span>
            <span className="text-xs">{formatCurrency(r.shortageValue)}</span>
          </div>
        ) : (
          muted
        ),
    },
    {
      key: 'inTransit',
      label: 'In transit',
      sortable: true,
      sortValue: (r) => r.inTransit,
      align: 'right',
      render: (r) =>
        r.inTransit > 0 ? <span className="tabular-nums text-warning-600">{r.inTransit} {r.inTransit === 1 ? 'trip' : 'trips'}</span> : muted,
    },
    { key: 'amount', label: 'Spend', sortable: true, sortValue: (r) => r.amount, align: 'right', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
  ];

  return (
    <ReportTable
      title={title}
      noun={noun}
      rows={rows}
      columns={columns}
      getRowKey={(r) => `${noun}-${r.key}`}
      searchText={(r) => r.label ?? ''}
      defaultSort={{ field: 'amount', direction: 'desc' }}
      subtitle={(sort) =>
        `${rows.length} ${rows.length === 1 ? noun : `${noun}s`} · sorted by ${columns.find((c) => c.key === sort.field)?.label.toLowerCase()}, ${
          sort.direction === 'desc' ? 'highest first' : sort.field === 'label' ? 'A–Z' : 'lowest first'
        }`
      }
      emptyMessage="No collections in this period."
    />
  );
}

function CollectionReport({ data }) {
  return (
    <>
      <Summary
        items={[
          ['Trips', String(data.totals.trips)],
          ['Litres collected', formatLitres(data.totals.collectedQuantity)],
          ['Spend at pumps', formatCurrency(data.totals.amount)],
          ['Transit loss', `${formatLitres(data.totals.shortageQuantity)} · ${formatCurrency(data.totals.shortageValue)}`, 'text-danger-600'],
        ]}
      />
      <div className="flex flex-col gap-5">
        <CollectionBreakdown title="By fuel station" noun="station" nameHeading="Station" rows={data.byStation} />
        <CollectionBreakdown title="By carrier vehicle" noun="carrier" nameHeading="Carrier vehicle" rows={data.byCarrier} splitName />
      </div>
    </>
  );
}

const LOADERS = {
  register: fuelReportsApi.siteRegister,
  assets: fuelReportsApi.assetConsumption,
  collections: fuelReportsApi.collections,
};

export default function FuelReportsPage() {
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
        <h1 className="text-xl font-semibold text-steel-900">Fuel Reports</h1>
        <p className="mt-1 text-steel-500">Stock, use and cost for any period.</p>
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
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
        />
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value }))}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
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
      {data?.tab === tab && tab === 'assets' && <AssetReport data={data.report} />}
      {data?.tab === tab && tab === 'collections' && <CollectionReport data={data.report} />}
    </div>
  );
}
