import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { purchasesApi, suppliersApi, itemsApi, storageLocationsApi, unitsOfMeasureApi, sitesApi } from '../../api/client';
import { Alert, Badge, Button, Card, Modal, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children ?? <span className="text-steel-400">—</span>}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  return <Badge tone={status === 'received' ? 'success' : 'warning'}>{status}</Badge>;
}

export default function PurchaseDetailPage() {
  const { id } = useParams();

  const [purchase, setPurchase] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [lookups, setLookups] = useState({ suppliers: [], items: [], locations: [], units: [], sites: [] });
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState(null);
  const [confirmingReceive, setConfirmingReceive] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await purchasesApi.get(id);
      setPurchase(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      suppliersApi.list({ limit: 100 }),
      itemsApi.list({ limit: 100 }),
      storageLocationsApi.list({ limit: 100 }),
      unitsOfMeasureApi.list({ limit: 100 }),
      sitesApi.list({ limit: 100 }),
    ])
      .then(([suppliers, items, locations, units, sites]) => {
        setLookups({ suppliers: suppliers.data, items: items.data, locations: locations.data, units: units.data, sites: sites.data });
      })
      .catch(() => {});
  }, []);

  async function handleReceive() {
    setReceiving(true);
    setReceiveError(null);
    try {
      await purchasesApi.receive(id, {});
      setConfirmingReceive(false);
      await load();
    } catch (err) {
      setReceiveError(err.message);
    } finally {
      setReceiving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/inventory/movements" state={{ type: "PURCHASE" }} className="font-semibold text-brand-600 hover:underline">
          Back to purchases
        </Link>
      </div>
    );
  }

  if (!purchase) return <Spinner label="Loading purchase" />;

  const supplierName = lookups.suppliers.find((s) => s.id === purchase.supplierId)?.supplierName ?? '—';
  const siteName = lookups.sites.find((s) => s.id === purchase.siteId)?.name ?? '—';
  const isDraft = purchase.status === 'draft';

  const itemName = (id) => lookups.items.find((i) => i.id === id)?.itemName ?? '—';
  const locationName = (id) => lookups.locations.find((l) => l.id === id)?.locationName ?? '—';
  const uomName = (id) => lookups.units.find((u) => u.id === id)?.uomName ?? '';

  const itemColumns = [
    { key: 'itemId', label: 'Item', render: (row) => itemName(row.itemId) },
    { key: 'storageLocationId', label: 'Storage location', render: (row) => locationName(row.storageLocationId) },
    {
      key: 'purchasedQuantity',
      label: 'Purchased',
      render: (row) => `${row.purchasedQuantity.toLocaleString()} ${uomName(row.uomId)}`,
    },
    {
      key: 'receivedQuantity',
      label: 'Received',
      render: (row) => `${row.receivedQuantity.toLocaleString()} ${uomName(row.uomId)}`,
    },
    {
      key: 'unitPriceInclTax',
      label: 'Unit price (incl. tax)',
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.unitPriceInclTax.toLocaleString()}</span>
          {row.taxPercentage > 0 && <span className="text-xs text-steel-500">incl. {row.taxPercentage}% tax</span>}
        </div>
      ),
    },
    { key: 'lineTotalAmount', label: 'Purchase price (incl. tax)', render: (row) => row.lineTotalAmount.toLocaleString() },
    { key: 'lineStatus', label: 'Status', render: (row) => <Badge tone={row.lineStatus === 'received' ? 'success' : 'neutral'}>{row.lineStatus}</Badge> },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/inventory/movements" state={{ type: "PURCHASE" }} className="text-sm font-semibold text-brand-600 hover:underline">
            ← All purchases
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{purchase.purchaseNumber}</h1>
          <div className="mt-1">
            <StatusBadge status={purchase.status} />
          </div>
        </div>

        {isDraft && (
          <div className="flex gap-2">
            <Can resource="PURCHASE" action="UPDATE">
              <Button as={Link} to={`/inventory/purchases/${purchase.id}/edit`} variant="secondary">
                Edit
              </Button>
            </Can>
            <Can resource="PURCHASE" action="RECEIVE">
              <Button onClick={() => setConfirmingReceive(true)}>Receive purchase</Button>
            </Can>
          </div>
        )}
      </div>

      <Card title="Purchase details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Site">{siteName}</Detail>
          <Detail label="Supplier">{supplierName}</Detail>
          <Detail label="Purchase date">{purchase.purchaseDate}</Detail>
          <Detail label="Subtotal (before tax)">{purchase.subtotalAmount.toLocaleString()}</Detail>
          <Detail label="Tax">{purchase.taxAmount.toLocaleString()}</Detail>
          <Detail label="Total (incl. tax)">{`${purchase.totalAmount.toLocaleString()} ${purchase.currencyCode}`}</Detail>
          <Detail label="Remarks">{purchase.remarks}</Detail>
        </dl>
      </Card>

      <Card title="Items" className="mt-4">
        <Table columns={itemColumns} rows={purchase.items} getRowKey={(row) => row.id} emptyMessage="No items on this purchase." />
      </Card>

      <Modal
        open={confirmingReceive}
        onClose={() => setConfirmingReceive(false)}
        title="Receive this purchase?"
        description="Every line receives its full purchased quantity, and stock is added at each storage location immediately. This can't be undone from this screen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingReceive(false)}>
              Cancel
            </Button>
            <Button loading={receiving} onClick={handleReceive}>
              Receive
            </Button>
          </>
        }
      >
        <Alert tone="error">{receiveError}</Alert>
      </Modal>
    </div>
  );
}
