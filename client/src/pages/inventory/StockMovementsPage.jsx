import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { purchasesApi, assetIssuesApi, stockTransfersApi, stockAdjustmentsApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../config/permissions';
import useSiteNames from '../../hooks/useSiteNames';
import { assetDescription, assetNumber } from '../../config/assetDetails';

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'PURCHASE', label: 'Purchases' },
  { value: 'ISSUE', label: 'Asset issues' },
  { value: 'TRANSFER', label: 'Transfers' },
  { value: 'ADJUSTMENT', label: 'Adjustments' },
];

const TYPE_LABEL = { PURCHASE: 'Purchase', ISSUE: 'Issue', TRANSFER: 'Transfer', ADJUSTMENT: 'Adjustment' };
const TYPE_TONE = { PURCHASE: 'success', ISSUE: 'warning', TRANSFER: 'brand', ADJUSTMENT: 'neutral' };

function StatusBadge({ status }) {
  if (!status) return <span className="text-steel-400">—</span>;
  const tone =
    status === 'completed' || status === 'received'
      ? 'success'
      : status === 'fully_reversed'
        ? 'neutral'
        : 'warning';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

function toRows(purchases, issues, transfers, adjustments) {
  return [
    ...purchases.map((p) => ({
      key: `PURCHASE-${p.id}`,
      type: 'PURCHASE',
      date: p.purchaseDate,
      createdAt: p.createdAt,
      reference: p.purchaseNumber,
      siteId: p.siteId,
      details: Number(p.totalAmount).toLocaleString(undefined, { style: 'currency', currency: p.currencyCode }),
      status: p.status,
      detailPath: `/inventory/purchases/${p.id}`,
    })),
    ...issues.map((i) => ({
      key: `ISSUE-${i.id}`,
      type: 'ISSUE',
      date: i.issueDateTime,
      createdAt: i.createdAt,
      reference: i.issueNumber,
      siteId: i.siteId,
      asset: assetNumber(i.assetType, i.assetId, i.asset),
      details: `${assetDescription(i.assetType, i.assetId, i.asset)}${i.issuedToPerson ? ` — ${i.issuedToPerson}` : ''}`,
      status: i.status,
      detailPath: `/inventory/asset-issues/${i.id}`,
    })),
    ...transfers.map((t) => ({
      key: `TRANSFER-${t.id}`,
      type: 'TRANSFER',
      date: t.transferDate,
      createdAt: t.createdAt,
      fromSiteId: t.fromSiteId,
      toSiteId: t.toSiteId,
      fromSiteName: t.fromSiteName,
      toSiteName: t.toSiteName,
      reference: t.transferNumber,
      details: '',
      status: t.status,
      detailPath: `/inventory/stock-transfers/${t.id}`,
    })),
    ...adjustments.map((a) => ({
      key: `ADJUSTMENT-${a.id}`,
      type: 'ADJUSTMENT',
      date: a.adjustmentDate,
      createdAt: a.createdAt,
      siteId: a.siteId,
      reference: a.adjustmentNumber,
      details: a.reason ?? '',
      status: null,
      detailPath: `/inventory/stock-adjustments/${a.id}`,
    })),
  ];
}

async function fetchMovements(active, canSeeTransfers, fetchList) {
  const params = { search: active.search || undefined };

  const wantPurchases = active.type === '' || active.type === 'PURCHASE';
  const wantIssues = active.type === '' || active.type === 'ISSUE';
  const wantTransfers = canSeeTransfers && (active.type === '' || active.type === 'TRANSFER');
  const wantAdjustments = active.type === '' || active.type === 'ADJUSTMENT';

  const [purchases, issues, transfers, adjustments] = await Promise.all([
    wantPurchases ? fetchList(purchasesApi.list, params) : Promise.resolve({ data: [] }),
    wantIssues ? fetchList(assetIssuesApi.list, params) : Promise.resolve({ data: [] }),
    wantTransfers ? fetchList(stockTransfersApi.list, params) : Promise.resolve({ data: [] }),
    wantAdjustments ? fetchList(stockAdjustmentsApi.list, params) : Promise.resolve({ data: [] }),
  ]);

  const merged = toRows(purchases.data, issues.data, transfers.data, adjustments.data);
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}

function siteLabel(row, siteNames) {
  return row.type === 'TRANSFER' ? `${row.fromSiteName ?? '—'} → ${row.toSiteName ?? '—'}` : (siteNames[row.siteId] ?? '—');
}

function statusLabel(status) {
  if (!status) return '—';
  const text = status.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function StockMovementsPage() {
  const location = useLocation();
  const [filters, setFilters] = useState({ search: '', type: location.state?.type ?? '', page: 1 });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const siteNames = useSiteNames();
  const { role } = useAuth();
  const canSeeTransfers = hasPermission(role, 'STOCK_TRANSFER', 'READ');
  const typeOptions = canSeeTransfers ? TYPE_OPTIONS : TYPE_OPTIONS.filter((o) => o.value !== 'TRANSFER');

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      setRows(await fetchMovements(activeFilters, canSeeTransfers, listAll));
    } catch (err) {
      setError(err.message);
    }
  }, [canSeeTransfers]);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  const total = rows?.length ?? 0;
  const pages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const pageRows = rows ? rows.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE) : [];

  const columns = [
    { key: 'type', label: 'Type', render: (r) => <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge> },
    { key: 'reference', label: 'Reference' },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    {
      key: 'site',
      label: 'Site',
      render: (r) => siteLabel(r, siteNames),
    },
    { key: 'asset', label: 'Asset', render: (r) => r.asset ?? <span className="text-steel-400">—</span> },
    { key: 'details', label: 'Details', wrap: true, render: (r) => r.details || <span className="text-steel-400">—</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Link to={r.detailPath} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  async function buildPrintReport() {
    const data = await fetchMovements(filters, canSeeTransfers, listAll);
    const applied = [];
    if (filters.search.trim()) applied.push({ label: 'Search', value: filters.search.trim() });
    if (filters.type) applied.push({ label: 'Type', value: TYPE_OPTIONS.find((o) => o.value === filters.type).label });

    return {
      title: 'Stock Movements',
      filters: applied,
      summary: [{ label: 'Movements', value: data.length.toLocaleString('en-IN') }],
      sections: [
        {
          title: 'Stock movements',
          rows: data,
          getRowKey: (r) => r.key,
          emptyMessage: 'No stock movements match these filters.',
          columns: [
            { key: 'type', label: 'Type', render: (r) => TYPE_LABEL[r.type] },
            { key: 'reference', label: 'Reference', render: (r) => r.reference },
            { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
            { key: 'site', label: 'Site', render: (r) => siteLabel(r, siteNames) },
            { key: 'asset', label: 'Asset', render: (r) => r.asset ?? '—' },
            { key: 'details', label: 'Details', render: (r) => r.details || '—' },
            { key: 'status', label: 'Status', render: (r) => statusLabel(r.status) },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Stock Movements</h1>
          <p className="mt-1 text-steel-500">Everything that's happened to stock: bought in, issued out, moved, or corrected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="PURCHASE" action="CREATE">
            <Button as={Link} to="/inventory/purchases/new" variant="secondary">
              + Purchase
            </Button>
          </Can>
          <Can resource="ASSET_ISSUE" action="CREATE">
            <Button as={Link} to="/inventory/asset-issues/new" variant="secondary">
              + Issue
            </Button>
          </Can>
          <Can resource="STOCK_TRANSFER" action="CREATE">
            <Button as={Link} to="/inventory/stock-transfers/new" variant="secondary">
              + Transfer
            </Button>
          </Can>
          <Can resource="STOCK_ADJUSTMENT" action="CREATE">
            <Button as={Link} to="/inventory/stock-adjustments/new" variant="secondary">
              + Adjustment
            </Button>
          </Can>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3 sm:max-w-2xl">
        <Input
          placeholder="Reference, Reg. no. or RCPL..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!rows ? (
          <Spinner label="Loading stock movements" />
        ) : (
          <>
            <Table columns={columns} rows={pageRows} getRowKey={(r) => r.key} emptyMessage="No stock movements match these filters." />
            <Pagination page={filters.page} pages={pages} total={total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>
    </div>
  );
}
