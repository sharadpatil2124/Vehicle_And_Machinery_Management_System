import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { fuelCollectionsApi } from '../../api/client';
import { Alert, Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import { COLLECTION_STATUS, formatCurrency, formatDateOnly, formatLitres, todayDateOnly } from '../../config/fuel';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children ?? <span className="text-steel-400">—</span>}</dd>
    </div>
  );
}

function ReceiveModal({ open, collection, onClose, onReceived }) {
  const [form, setForm] = useState({ receivedQuantity: '', receivedDate: todayDateOnly(), receiptNotes: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && collection) {
      setForm({ receivedQuantity: String(collection.quantity), receivedDate: todayDateOnly(), receiptNotes: '' });
      setError(null);
    }
  }, [open, collection]);

  if (!collection) return null;

  const received = Number(form.receivedQuantity);
  const validQuantity = form.receivedQuantity !== '' && received >= 0 && received <= collection.quantity;
  const shortage = validQuantity ? Math.round((collection.quantity - received) * 1000) / 1000 : null;
  const shortageValue = validQuantity
    ? Math.round((collection.amount - Math.round(received * collection.pricePerLitre * 100) / 100) * 100) / 100
    : null;

  async function handleSubmit() {
    setError(null);
    if (!validQuantity) {
      setError(`Enter the litres that arrived — between 0 and ${formatLitres(collection.quantity)}.`);
      return;
    }
    if (!form.receivedDate) {
      setError('Enter the date the fuel arrived.');
      return;
    }
    setSubmitting(true);
    try {
      await fuelCollectionsApi.receive(collection.id, {
        receivedQuantity: received,
        receivedDate: form.receivedDate,
        receiptNotes: form.receiptNotes.trim() || undefined,
      });
      onReceived(`${formatLitres(received)} received and added to ${collection.siteName}'s stock.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive fuel at the site"
      description={`${formatLitres(collection.quantity)} of ${collection.fuelType} was collected. Enter what actually arrived.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Receive fuel
          </Button>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>
      <Field label="Litres received" required>
        {({ id, describedBy }) => (
          <Input
            id={id}
            describedBy={describedBy}
            type="number"
            min={0}
            max={collection.quantity}
            step="any"
            value={form.receivedQuantity}
            onChange={(e) => setForm((f) => ({ ...f, receivedQuantity: e.target.value }))}
            autoFocus
          />
        )}
      </Field>
      <Field label="Date received" required>
        {({ id, describedBy }) => (
          <Input
            id={id}
            describedBy={describedBy}
            type="date"
            min={collection.collectionDate}
            max={todayDateOnly()}
            value={form.receivedDate}
            onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
          />
        )}
      </Field>
      <Field label="Notes" hint="e.g. why litres are short.">
        {({ id, describedBy }) => (
          <Input id={id} describedBy={describedBy} value={form.receiptNotes} onChange={(e) => setForm((f) => ({ ...f, receiptNotes: e.target.value }))} maxLength={2000} />
        )}
      </Field>
      {shortage !== null && (
        <p className={`text-sm ${shortage > 0 ? 'font-semibold text-danger-600' : 'text-steel-600'}`}>
          {shortage > 0 ? `Transit loss: ${formatLitres(shortage)} worth ${formatCurrency(shortageValue)}` : 'No transit loss — everything collected arrived.'}
        </p>
      )}
    </Modal>
  );
}

export default function FuelCollectionDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [collection, setCollection] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fuelCollectionsApi.get(id);
      setCollection(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel() {
    setCancelPending(true);
    setCancelError(null);
    try {
      await fuelCollectionsApi.cancel(collection.id, 'DELETE');
      setCancelOpen(false);
      setNotice('Collection cancelled. It stays in history.');
      await load();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelPending(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/fuel/collections" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Back to fuel collections
        </Link>
      </div>
    );
  }
  if (!collection) return <Spinner label="Loading collection" />;

  const status = COLLECTION_STATUS[collection.status];
  const inTransit = collection.status === 'in_transit';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/fuel/collections" className="text-sm font-semibold text-brand-600 hover:underline">
            ← Fuel collections
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{collection.collectionNumber}</h1>
          <div className="mt-1">
            <Badge tone={status?.tone}>{status?.label ?? collection.status}</Badge>
          </div>
        </div>

        {inTransit && (
          <div className="flex flex-wrap gap-2">
            <Can resource="FUEL_COLLECTION" action="UPDATE">
              <Button as={Link} to={`/fuel/collections/${collection.id}/edit`} variant="secondary">
                Edit
              </Button>
            </Can>
            <Can resource="FUEL_COLLECTION" action="CANCEL">
              <Button
                variant="danger"
                onClick={() => {
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                Cancel collection
              </Button>
            </Can>
            <Can resource="FUEL_COLLECTION" action="RECEIVE">
              <Button onClick={() => setReceiveOpen(true)}>Receive fuel</Button>
            </Can>
          </div>
        )}
      </div>

      <Alert tone="success">{notice}</Alert>
      {inTransit && (
        <Alert tone="info">
          In transit — this fuel isn't in {collection.siteName}'s stock yet. Click <strong>Receive fuel</strong> when the vehicle is back.
        </Alert>
      )}

      <Card title="Collection at the pump">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Site">{collection.siteName}</Detail>
          <Detail label="Carrier vehicle">
            {collection.carrierLabel} <span className="text-steel-500">({collection.carrierAssetId})</span>
          </Detail>
          <Detail label="Fuel station">{collection.fuelStationName}</Detail>
          <Detail label="Fuel type">{collection.fuelType}</Detail>
          <Detail label="Collection date">{formatDateOnly(collection.collectionDate)}</Detail>
          <Detail label="Bill number">{collection.billNumber}</Detail>
          <Detail label="Litres collected">
            <span className="tabular-nums">{formatLitres(collection.quantity)}</span>
          </Detail>
          <Detail label="Rate per litre">
            <span className="tabular-nums">{formatCurrency(collection.pricePerLitre)}</span>
          </Detail>
          <Detail label="Amount paid">
            <span className="font-semibold tabular-nums">{formatCurrency(collection.amount)}</span>
          </Detail>
          <Detail label="Driver">{collection.driverName}</Detail>
          <Detail label="Notes">{collection.notes}</Detail>
        </dl>
      </Card>

      <Card title="Cans" className="mt-4">
        <Table
          columns={[
            { key: 'containerCount', label: 'Number of cans' },
            { key: 'litresPerContainer', label: 'Litres in each', render: (r) => formatLitres(r.litresPerContainer) },
            { key: 'total', label: 'Total', render: (r) => <span className="tabular-nums">{formatLitres(r.containerCount * r.litresPerContainer)}</span> },
          ]}
          rows={collection.containers}
          getRowKey={(r) => r.id}
        />
      </Card>

      {collection.status === 'received' && (
        <Card title="Received at the site" className="mt-4">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Date received">{formatDateOnly(collection.receivedDate)}</Detail>
            <Detail label="Litres received">
              <span className="tabular-nums">{formatLitres(collection.receivedQuantity)}</span>
            </Detail>
            <Detail label="Transit loss">
              {collection.shortageQuantity > 0 ? (
                <span className="font-semibold text-danger-600 tabular-nums">
                  {formatLitres(collection.shortageQuantity)} · {formatCurrency(collection.shortageValue)}
                </span>
              ) : (
                <span className="text-success-600">None</span>
              )}
            </Detail>
            <Detail label="Notes">{collection.receiptNotes}</Detail>
          </dl>
        </Card>
      )}

      <ReceiveModal
        open={receiveOpen}
        collection={collection}
        onClose={() => setReceiveOpen(false)}
        onReceived={async (message) => {
          setReceiveOpen(false);
          setNotice(message);
          await load();
        }}
      />

      <DeleteWordModal
        open={cancelOpen}
        title="Cancel this collection?"
        description={`${collection.collectionNumber} will be marked cancelled and kept in history. No stock is affected because it was never received.`}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        pending={cancelPending}
        error={cancelError}
        confirmLabel="Cancel collection"
      />
    </div>
  );
}
