import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { stockAdjustmentsApi } from '../../api/client';
import { Alert, Badge, Card, Spinner, Table } from '../../components/ui';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children ?? <span className="text-steel-400">—</span>}</dd>
    </div>
  );
}

export default function StockAdjustmentDetailPage() {
  const { id } = useParams();

  const [adjustment, setAdjustment] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    stockAdjustmentsApi
      .get(id)
      .then((response) => setAdjustment(response.data))
      .catch((err) => setLoadError(err.message));
  }, [id]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/inventory/movements" state={{ type: "ADJUSTMENT" }} className="font-semibold text-brand-600 hover:underline">
          Back to stock adjustments
        </Link>
      </div>
    );
  }

  if (!adjustment) return <Spinner label="Loading stock adjustment" />;


  const columns = [
    { key: 'itemId', label: 'Item', render: (row) => row.itemName ?? '—' },
    { key: 'systemQuantity', label: 'System had', render: (row) => row.systemQuantity.toLocaleString() },
    { key: 'countedQuantity', label: 'Counted', render: (row) => row.countedQuantity.toLocaleString() },
    {
      key: 'adjustmentQuantity',
      label: 'Difference',
      render: (row) => (
        <Badge tone={row.adjustmentQuantity === 0 ? 'neutral' : row.adjustmentQuantity > 0 ? 'success' : 'danger'}>
          {row.adjustmentQuantity > 0 ? '+' : ''}
          {row.adjustmentQuantity.toLocaleString()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <Link to="/inventory/movements" state={{ type: "ADJUSTMENT" }} className="text-sm font-semibold text-brand-600 hover:underline">
          ← All stock adjustments
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{adjustment.adjustmentNumber}</h1>
      </div>

      <Card title="Adjustment details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Site">{adjustment.siteName ?? '—'}</Detail>
          <Detail label="Adjustment date">{adjustment.adjustmentDate}</Detail>
          <Detail label="Reason">{adjustment.reason}</Detail>
        </dl>
      </Card>

      <Card title="Items" className="mt-4">
        <Table columns={columns} rows={adjustment.items} getRowKey={(row) => row.id} emptyMessage="No items on this adjustment." />
      </Card>
    </div>
  );
}
