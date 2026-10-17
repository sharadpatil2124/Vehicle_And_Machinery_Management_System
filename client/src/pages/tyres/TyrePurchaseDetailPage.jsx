import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Badge, Button, Card, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import { formatCurrency, formatDateOnly, formatNumber } from '../../config/tyres';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children}</dd>
    </div>
  );
}

export default function TyrePurchaseDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [cancelling, setCancelling] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async () => {
    try {
      const response = await tyresApi.purchase(id);
      setPurchase(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel() {
    setPending(true);
    setCancelError(null);
    try {
      const response = await tyresApi.cancelPurchase(purchase.id, 'DELETE');
      setPurchase(response.data);
      setCancelling(false);
      setNotice(`${purchase.purchaseNumber} cancelled — its tyres were taken out of stock.`);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (error && !purchase) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{error}</Alert>
        <Link to="/tyres/purchases" className="font-semibold text-brand-600 hover:underline">
          Back to tyre purchases
        </Link>
      </div>
    );
  }
  if (!purchase) return <Spinner label="Loading purchase" />;

  const columns = [
    {
      key: 'type',
      label: 'Tyre type',
      render: (i) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{i.tyreTypeLabel}</span>
          <span className="text-xs text-steel-500">{i.tyreSize}</span>
        </div>
      ),
    },
    { key: 'quantity', label: 'Quantity', align: 'right', render: (i) => <span className="tabular-nums">{i.quantity}</span> },
    { key: 'unitPrice', label: 'Price / tyre (before GST)', align: 'right', render: (i) => <span className="tabular-nums">{formatCurrency(i.unitPrice)}</span> },
    { key: 'taxPercentage', label: 'GST %', align: 'right', render: (i) => <span className="tabular-nums">{formatNumber(i.taxPercentage)}%</span> },
    { key: 'unitCost', label: 'Price / tyre (incl. GST)', align: 'right', render: (i) => <span className="tabular-nums">{formatCurrency(i.unitCost)}</span> },
    { key: 'lineTotal', label: 'Line total', align: 'right', render: (i) => <span className="font-semibold tabular-nums">{formatCurrency(i.lineTotal)}</span> },
  ];

  const active = purchase.status === 'active';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tyres/purchases" className="text-sm font-semibold text-brand-600 hover:underline">
            ← Tyre purchases
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{purchase.purchaseNumber}</h1>
          <div className="mt-2">
            <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Received into stock' : 'Cancelled'}</Badge>
          </div>
        </div>
        {active && (
          <Can resource="TYRE" action="DELETE">
            <Button
              variant="danger"
              onClick={() => {
                setCancelError(null);
                setCancelling(true);
              }}
            >
              Cancel purchase
            </Button>
          </Can>
        )}
      </div>

      <Alert tone="success">{notice}</Alert>

      <Card title="Purchase details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Site">{purchase.siteName ?? '—'}</Detail>
          <Detail label="Supplier">{purchase.supplierName ?? '—'}</Detail>
          <Detail label="Purchase date">{formatDateOnly(purchase.purchaseDate)}</Detail>
          <Detail label="Bill / invoice no.">{purchase.billNumber ?? '—'}</Detail>
          {purchase.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Detail label="Notes">
                <span className="whitespace-pre-line">{purchase.notes}</span>
              </Detail>
            </div>
          )}
          {!active && <Detail label="Cancelled on">{new Date(purchase.cancelledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</Detail>}
        </dl>
      </Card>

      <Card title="Tyres" className="mt-4">
        <Table columns={columns} rows={purchase.items} getRowKey={(i) => i.id} />
        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-steel-600">{purchase.tyreCount} tyres · before GST</dt>
              <dd className="tabular-nums">{formatCurrency(purchase.subtotalAmount)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-steel-600">GST</dt>
              <dd className="tabular-nums">{formatCurrency(purchase.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-steel-200 pt-2 font-semibold text-steel-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(purchase.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <DeleteWordModal
        open={cancelling}
        title={`Cancel ${purchase.purchaseNumber}?`}
        description="Its tyres are taken back out of stock. This is only possible while none of them have been fitted."
        onCancel={() => setCancelling(false)}
        onConfirm={handleCancel}
        pending={pending}
        error={cancelError}
        confirmLabel="Cancel purchase"
      />
    </div>
  );
}
