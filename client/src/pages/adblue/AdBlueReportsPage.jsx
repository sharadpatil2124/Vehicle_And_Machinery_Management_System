import { useEffect, useState } from 'react';
import { adblueApi } from '../../api/client';
import { Alert, Input, Select, Spinner, Tabs } from '../../components/ui';
import ReportTable from '../../components/ReportTable';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { firstOfMonthDateOnly, formatCurrency, formatLitres, todayDateOnly } from '../../config/fuel';

const TABS = [
  { value: 'vehicles', label: 'Vehicle-wise' },
  { value: 'machinery', label: 'Machinery-wise' },
  { value: 'sites', label: 'Site-wise' },
];

const litres = (v) => <span className="tabular-nums">{formatLitres(v)}</span>;
const money = (v) => <span className="tabular-nums">{formatCurrency(v)}</span>;

function Summary({ items }) {
  return (
    <dl className="mb-4 grid gap-4 rounded border border-steel-200 bg-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AssetReport({ rows, noun, numberHeading }) {
  const columns = [
    {
      key: 'asset',
      label: numberHeading,
      sortable: true,
      sortValue: (r) => r.assetLabel ?? r.assetId,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.assetLabel ?? r.assetId}</span>
          <span className="text-xs text-steel-500">{r.assetId}</span>
        </div>
      ),
    },
    { key: 'fills', label: 'Fillings', sortable: true, sortValue: (r) => r.fills },
    { key: 'quantity', label: 'Litres consumed', sortable: true, sortValue: (r) => r.quantity, render: (r) => litres(r.quantity) },
    { key: 'cost', label: 'Cost', sortable: true, sortValue: (r) => r.cost, render: (r) => <span className="font-semibold">{money(r.cost)}</span> },
  ];
  const sum = (pick) => rows.reduce((total, r) => total + pick(r), 0);

  return (
    <>
      <Summary
        items={[
          [`${noun === 'vehicle' ? 'Vehicles' : 'Machines'} filled`, String(rows.length)],
          ['Total consumed', formatLitres(sum((r) => r.quantity))],
          ['Total cost', formatCurrency(sum((r) => r.cost))],
        ]}
      />
      <ReportTable
        noun={noun}
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.assetId}
        searchText={(r) => `${r.assetLabel ?? ''} ${r.assetId}`}
        emptyMessage={`No AdBlue filled into any ${noun} in this period.`}
      />
    </>
  );
}

function SiteReport({ rows }) {
  const columns = [
    { key: 'siteName', label: 'Site', sortable: true, sortValue: (r) => r.siteName ?? '', render: (r) => <span className="font-semibold text-steel-900">{r.siteName ?? '—'}</span> },
    { key: 'fills', label: 'Fillings', sortable: true, sortValue: (r) => r.fills },
    { key: 'consumedQuantity', label: 'Litres consumed', sortable: true, sortValue: (r) => r.consumedQuantity, render: (r) => litres(r.consumedQuantity) },
    { key: 'consumedCost', label: 'Cost consumed', sortable: true, sortValue: (r) => r.consumedCost, render: (r) => <span className="font-semibold">{money(r.consumedCost)}</span> },
    { key: 'purchasedQuantity', label: 'Litres purchased', sortable: true, sortValue: (r) => r.purchasedQuantity, render: (r) => litres(r.purchasedQuantity) },
    { key: 'purchasedCost', label: 'Purchase spend', sortable: true, sortValue: (r) => r.purchasedCost, render: (r) => money(r.purchasedCost) },
  ];
  const sum = (pick) => rows.reduce((total, r) => total + pick(r), 0);

  return (
    <>
      <Summary
        items={[
          ['Total consumed', formatLitres(sum((r) => r.consumedQuantity))],
          ['Cost consumed', formatCurrency(sum((r) => r.consumedCost))],
          ['Total purchased', formatLitres(sum((r) => r.purchasedQuantity))],
          ['Purchase spend', formatCurrency(sum((r) => r.purchasedCost))],
        ]}
      />
      <ReportTable noun="site" rows={rows} columns={columns} getRowKey={(r) => r.siteId} searchText={(r) => r.siteName ?? ''} emptyMessage="No AdBlue purchased or filled in this period." />
    </>
  );
}

export default function AdBlueReportsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [tab, setTab] = useState('vehicles');
  const [filters, setFilters] = useState({ dateFrom: firstOfMonthDateOnly(), dateTo: todayDateOnly(), siteId: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    adblueApi
      .reports({ dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, siteId: filters.siteId || undefined })
      .then((r) => !cancelled && setData(r.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">AdBlue Reports</h1>
        <p className="mt-1 text-steel-500">AdBlue consumption and cost for any period.</p>
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
      {!data && !error && <Spinner label="Loading report" />}
      {data && tab === 'vehicles' && <AssetReport rows={data.vehicles} noun="vehicle" numberHeading="Registration number" />}
      {data && tab === 'machinery' && <AssetReport rows={data.machinery} noun="machine" numberHeading="RCPL" />}
      {data && tab === 'sites' && <SiteReport rows={data.sites} />}
    </div>
  );
}
