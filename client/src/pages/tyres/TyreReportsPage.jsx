import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Input, Select, Spinner, Tabs } from '../../components/ui';
import ReportTable, { ReportPagination, ReportSearch } from '../../components/ReportTable';
import usePagedRows from '../../hooks/usePagedRows';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { assetPath, formatCurrency, formatDateOnly, formatRun, todayDateOnly } from '../../config/tyres';

const TABS = [
  { value: 'assets', label: 'By vehicle & machine' },
  { value: 'costs', label: 'Tyre costs' },
];

const TILE_COLUMNS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' };

function Tiles({ items }) {
  return (
    <dl className={`mb-4 grid gap-3 sm:grid-cols-2 ${TILE_COLUMNS[items.length] ?? 'lg:grid-cols-4'}`}>
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded border border-steel-200 bg-surface px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-1 text-xl font-semibold text-steel-900 tabular-nums">{value}</dd>
          {hint && <dd className="text-xs text-steel-500">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

const assetSearchText = (r) => `${r.assetLabel ?? ''} ${r.assetId} ${r.siteName ?? ''}`;

const STATUS_LABELS = { active: 'Active', replaced: 'Replaced', off: 'Off asset' };

function statusCounts({ active, replaced, off }) {
  return [`${active} active`, replaced ? `${replaced} replaced` : null, off ? `${off} off asset` : null].filter(Boolean).join(' · ');
}

function AssetReport({ data }) {
  const [open, setOpen] = useState(() => new Set());
  const paged = usePagedRows(data.rows, { searchText: assetSearchText });
  const t = data.totals;
  const toggle = (key) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const th = 'px-4 py-3 text-xs font-semibold tracking-wide text-steel-500 uppercase whitespace-nowrap';
  const td = 'px-4 py-3 align-top';

  return (
    <>
      <Tiles
        items={[
          ['Tyres fitted', String(t.tyresFitted), statusCounts({ active: t.onAssets, replaced: t.replaced, off: t.offAsset })],
          ['Tyre cost', formatCurrency(t.tyreCost), 'Incl. GST'],
        ]}
      />
      <section className="rounded border border-steel-200 bg-surface">
        {paged.needsControls && (
          <header className="flex flex-col gap-3 border-b border-steel-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-steel-500">
              {data.rows.length} vehicles &amp; machines
            </p>
            <ReportSearch noun="asset" value={paged.search} onChange={paged.setSearch} />
          </header>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-steel-200">
                <th className={th}>Asset</th>
                <th className={`${th} text-right`}>Tyres</th>
                <th className={`${th} text-right`}>Tyre run</th>
                <th className={`${th} text-right`}>Tyre cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {paged.visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-steel-500">
                    {paged.term ? `No assets match "${paged.search.trim()}".` : 'No tyres were fitted in this period.'}
                  </td>
                </tr>
              )}
              {paged.visible.map((r) => {
                const key = `${r.assetType}:${r.assetId}`;
                const expanded = open.has(key);
                const path = assetPath(r);
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-steel-50">
                      <td className={td}>
                        <div className="flex items-start gap-2">
                          <button type="button" aria-expanded={expanded} aria-label={expanded ? 'Hide tyres' : 'Show tyres'} className="mt-0.5 w-4 text-steel-500 hover:text-steel-900" onClick={() => toggle(key)}>
                            {expanded ? '▾' : '▸'}
                          </button>
                          <div className="flex flex-col">
                            {path ? (
                              <Link to={path} className="font-semibold text-brand-600 hover:underline">
                                {r.assetLabel}
                              </Link>
                            ) : (
                              <span className="font-semibold text-steel-900">{r.assetLabel}</span>
                            )}
                            <span className="text-xs text-steel-500">
                              {r.assetId} · {r.assetKind}
                              {r.siteName ? ` · ${r.siteName}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-right`}>
                        <button type="button" className="tabular-nums hover:underline" onClick={() => toggle(key)}>
                          {r.tyreCount}
                        </button>
                        <span className="block text-xs text-steel-500">{statusCounts({ active: r.onAssetCount, replaced: r.replacedCount, off: r.offAssetCount })}</span>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{formatRun(r.tyreRun, r.meterType)}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatCurrency(r.tyreCost)}</td>
                    </tr>
                    {expanded &&
                      r.tyres.map((tyre) => (
                        <tr key={tyre.id} className="bg-steel-50 text-xs">
                          <td className="py-2 pr-4 pl-12">
                            <span className="font-semibold text-steel-900">{tyre.position}</span> · {tyre.tyreTypeLabel} {tyre.tyreSize}
                            {tyre.tyreCondition === 'used' ? ' (used)' : ''}
                            <span className="block text-steel-500">
                              Fitted {formatDateOnly(tyre.fittedAt)} at {formatRun(tyre.fitMeterReading, tyre.meterType)}
                              {tyre.isOnAsset ? '' : ` · ${tyre.fitmentStatus === 'replaced' ? 'replaced' : 'taken off'} ${formatDateOnly(tyre.removedAt)} at ${formatRun(tyre.removeMeterReading, tyre.meterType)}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{STATUS_LABELS[tyre.fitmentStatus]}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatRun(tyre.run, tyre.meterType)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(tyre.cost)}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <ReportPagination paged={paged} />
      </section>
    </>
  );
}

function CostReport({ data }) {
  const t = data.totals;
  const money = (v) => <span className="tabular-nums">{formatCurrency(v)}</span>;
  const num = (v) => <span className="tabular-nums">{v}</span>;
  const typeColumns = [
    {
      key: 'type',
      label: 'Tyre type',
      sortable: true,
      sortValue: (r) => r.tyreTypeLabel ?? '',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.tyreTypeLabel}</span>
          <span className="text-xs text-steel-500">{r.tyreSize}</span>
        </div>
      ),
    },
    { key: 'bought', label: 'Bought', align: 'right', sortable: true, sortValue: (r) => r.bought, render: (r) => num(r.bought) },
    { key: 'purchaseCost', label: 'Purchase cost', align: 'right', sortable: true, sortValue: (r) => r.purchaseCost, render: (r) => money(r.purchaseCost) },
    { key: 'fitted', label: 'Fitted', align: 'right', sortable: true, sortValue: (r) => r.fitted, render: (r) => num(r.fitted) },
    { key: 'inStock', label: 'In stock now', align: 'right', sortable: true, sortValue: (r) => r.inStock + r.usedInStock, render: (r) => num(r.usedInStock ? `${r.inStock} + ${r.usedInStock} used` : r.inStock) },
    { key: 'stockValue', label: 'Stock value', align: 'right', sortable: true, sortValue: (r) => r.stockValue, render: (r) => <span className="font-semibold">{money(r.stockValue)}</span> },
  ];
  const supplierColumns = [
    { key: 'supplierName', label: 'Supplier', sortable: true, sortValue: (r) => r.supplierName ?? '', render: (r) => <span className="font-semibold text-steel-900">{r.supplierName}</span> },
    { key: 'purchases', label: 'Purchases', align: 'right', sortable: true, sortValue: (r) => r.purchases, render: (r) => num(r.purchases) },
    { key: 'tyres', label: 'Tyres', align: 'right', sortable: true, sortValue: (r) => r.tyres, render: (r) => num(r.tyres) },
    { key: 'beforeTax', label: 'Before GST', align: 'right', sortable: true, sortValue: (r) => r.beforeTax, render: (r) => money(r.beforeTax) },
    { key: 'tax', label: 'GST', align: 'right', sortable: true, sortValue: (r) => r.tax, render: (r) => money(r.tax) },
    { key: 'total', label: 'Total', align: 'right', sortable: true, sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{money(r.total)}</span> },
  ];

  return (
    <>
      <Tiles
        items={[
          ['Tyres bought', formatCurrency(t.purchaseCost), `${t.tyresBought} tyres · GST ${formatCurrency(t.purchaseTax)}`],
          ['Fitted to assets', formatCurrency(t.fittedCost), `${t.tyresFitted} tyres`],
          ['In stock now', formatCurrency(t.stockValue), `${t.inStock} new${t.usedInStock ? ` · ${t.usedInStock} used` : ''}`],
        ]}
      />
      <ReportTable
        title="By tyre type"
        noun="tyre type"
        rows={data.byType}
        columns={typeColumns}
        getRowKey={(r) => r.tyreTypeId}
        searchText={(r) => `${r.tyreTypeLabel ?? ''} ${r.tyreSize ?? ''}`}
        emptyMessage="No tyre activity in this period."
      />
      <ReportTable
        className="mt-4"
        title="By supplier"
        noun="supplier"
        rows={data.bySupplier}
        columns={supplierColumns}
        getRowKey={(r) => r.key}
        searchText={(r) => r.supplierName ?? ''}
        emptyMessage="No tyre purchases in this period."
      />
    </>
  );
}

const LOADERS = { assets: tyresApi.assetReport, costs: tyresApi.costReport };

export default function TyreReportsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [tab, setTab] = useState('assets');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', siteId: '', assetType: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    LOADERS[tab]({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      siteId: filters.siteId || undefined,
      assetType: tab === 'assets' ? filters.assetType || undefined : undefined,
    })
      .then((r) => !cancelled && setData({ tab, report: r.data }))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Tyre Reports</h1>
        <p className="mt-1 text-steel-500">Tyres fitted to each vehicle and machine, and what they cost. Leave the dates empty to see all records.</p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} max={filters.dateTo || todayDateOnly()} onChange={set('dateFrom')} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} min={filters.dateFrom || undefined} max={todayDateOnly()} onChange={set('dateTo')} />
        {isAdmin && (
          <Select aria-label="Site" value={filters.siteId} onChange={set('siteId')}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        {tab === 'assets' && (
          <Select aria-label="Asset type" value={filters.assetType} onChange={set('assetType')}>
            <option value="">Vehicles &amp; machinery</option>
            <option value="VEHICLE">Vehicles</option>
            <option value="MACHINERY">Machinery</option>
          </Select>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <Alert tone="error">{error}</Alert>
      {data?.tab !== tab && !error && <Spinner label="Loading report" />}
      {data?.tab === tab && tab === 'assets' && <AssetReport data={data.report} />}
      {data?.tab === tab && tab === 'costs' && <CostReport data={data.report} />}
    </div>
  );
}
