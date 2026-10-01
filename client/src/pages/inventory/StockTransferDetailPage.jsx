import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { stockTransfersApi } from '../../api/client';
import { Alert, Badge, Button, Card, Modal, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { useAuth } from '../../context/AuthContext';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children ?? <span className="text-steel-400">—</span>}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  return <Badge tone={status === 'completed' ? 'success' : 'warning'}>{status.replaceAll('_', ' ')}</Badge>;
}

export default function StockTransferDetailPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [transfer, setTransfer] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState(null);
  const [confirmingReceive, setConfirmingReceive] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await stockTransfersApi.get(id);
      setTransfer(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReceive() {
    setReceiving(true);
    setReceiveError(null);
    try {
      await stockTransfersApi.receive(id);
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
        <Link to="/inventory/movements" state={{ type: "TRANSFER" }} className="font-semibold text-brand-600 hover:underline">
          Back to stock transfers
        </Link>
      </div>
    );
  }

  if (!transfer) return <Spinner label="Loading stock transfer" />;

  const fromSiteName = transfer.fromSiteName ?? '—';
  const toSiteName = transfer.toSiteName ?? '—';

  const canReceiveHere = isAdmin || user?.siteId === transfer.toSiteId;

  const columns = [
    { key: 'itemId', label: 'Item', render: (row) => row.itemName ?? '—' },
    { key: 'fromStorageLocationId', label: 'From location', render: (row) => row.fromLocationName ?? '—' },
    { key: 'toStorageLocationId', label: 'To location', render: (row) => row.toLocationName ?? '—' },
    { key: 'quantity', label: 'Quantity', render: (row) => row.quantity.toLocaleString() },
    { key: 'unitCost', label: 'Unit cost', render: (row) => row.unitCost.toLocaleString() },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/inventory/movements" state={{ type: "TRANSFER" }} className="text-sm font-semibold text-brand-600 hover:underline">
            ← All stock transfers
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{transfer.transferNumber}</h1>
          <div className="mt-1">
            <StatusBadge status={transfer.status} />
          </div>
        </div>

        {transfer.status === 'in_transit' && canReceiveHere && (
          <Can resource="STOCK_TRANSFER" action="RECEIVE">
            <Button onClick={() => setConfirmingReceive(true)}>Receive transfer</Button>
          </Can>
        )}
      </div>

      <Card title="Transfer details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="From site">{fromSiteName}</Detail>
          <Detail label="To site">{toSiteName}</Detail>
          <Detail label="Transfer date">{transfer.transferDate}</Detail>
          <Detail label="Remarks">{transfer.remarks}</Detail>
        </dl>
      </Card>

      <Card title="Items" className="mt-4">
        <Table columns={columns} rows={transfer.items} getRowKey={(row) => row.id} emptyMessage="No items on this transfer." />
      </Card>

      <Modal
        open={confirmingReceive}
        onClose={() => setConfirmingReceive(false)}
        title="Receive this transfer?"
        description={`Stock moves now: it leaves ${fromSiteName} and is added to ${toSiteName}'s storage locations. This can't be undone from this screen.`}
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
