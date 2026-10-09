import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { assetIssuesApi } from '../api/client';
import { Alert, Badge, Card, Pagination, Spinner, Table } from './ui';

const PAGE_SIZE = 10;
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatQuantity(value) {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function StatusBadge({ status }) {
  const tone = status === 'fully_reversed' ? 'neutral' : status === 'partially_reversed' ? 'warning' : 'success';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

export default function InventoryHistoryCard({ assetType, assetId }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    assetIssuesApi
      .list({ assetType, assetId, include: 'items', sort: 'issueDateTime:desc', page, limit: PAGE_SIZE })
      .then((response) => {
        if (!cancelled) setResult(response);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [assetType, assetId, page]);

  const rows = (result?.data ?? []).flatMap((issue) =>
    (issue.items ?? []).map((line, index) => ({ key: `${issue.id}-${line.id}`, issue, line, first: index === 0 }))
  );

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (r) =>
        r.first ? new Date(r.issue.issueDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '',
    },
    { key: 'issueNumber', label: 'Issue', render: (r) => (r.first ? r.issue.issueNumber : '') },
    { key: 'itemName', label: 'Item', render: (r) => r.line.itemName ?? '—' },
    { key: 'locationName', label: 'Storage location', render: (r) => r.line.locationName ?? '—' },
    { key: 'issuedQuantity', label: 'Issued', render: (r) => <span className="tabular-nums">{formatQuantity(r.line.issuedQuantity)}</span> },
    {
      key: 'reversedQuantity',
      label: 'Returned',
      render: (r) =>
        r.line.reversedQuantity > 0 ? (
          <span className="tabular-nums">{formatQuantity(r.line.reversedQuantity)}</span>
        ) : (
          <span className="text-steel-400">—</span>
        ),
    },
    { key: 'unitCost', label: 'Unit cost (incl. tax)', render: (r) => <span className="tabular-nums">{currency.format(r.line.unitCost)}</span> },
    { key: 'totalCost', label: 'Total cost (incl. tax)', render: (r) => <span className="tabular-nums">{currency.format(r.line.totalCost)}</span> },
    { key: 'status', label: 'Status', render: (r) => (r.first ? <StatusBadge status={r.issue.status} /> : '') },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.first ? (
          <Link to={`/inventory/asset-issues/${r.issue.id}`} className="font-semibold text-brand-600 hover:underline">
            View
          </Link>
        ) : (
          ''
        ),
    },
  ];

  return (
    <Card title="Inventory history" subtitle="Parts and consumables issued to this asset from stock, newest first." className="mt-4">
      <Alert tone="error">{error}</Alert>
      {!result && !error ? (
        <Spinner label="Loading inventory history" />
      ) : result ? (
        <>
          <Table columns={columns} rows={rows} getRowKey={(r) => r.key} emptyMessage="No items have been issued to this asset yet." />
          {result.pagination.pages > 1 && (
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={setPage} />
          )}
        </>
      ) : null}
    </Card>
  );
}
