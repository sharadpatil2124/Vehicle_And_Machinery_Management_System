import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetIssuesApi, issueReversalsApi, itemsApi, storageLocationsApi } from '../../api/client';
import { Alert, Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '../../components/ui';
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
  const tone = status === 'fully_reversed' ? 'neutral' : status === 'partially_reversed' ? 'warning' : 'success';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ReverseLineModal({ open, line, onClose, onReversed }) {
  const [reversedQuantity, setReversedQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReversedQuantity('');
      setReason('');
      setError(null);
    }
  }, [open]);

  const remaining = line ? line.issuedQuantity - line.reversedQuantity : 0;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await issueReversalsApi.create({
        assetIssueId: line.assetIssueId,
        reason: reason || undefined,
        items: [{ assetIssueItemId: line.id, reversedQuantity: Number(reversedQuantity) }],
      });
      onReversed();
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
      title="Reverse this line"
      description={line ? `Up to ${remaining.toLocaleString()} can still be reversed on this line.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>
            Reverse
          </Button>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>
      <Field label="Quantity to reverse" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="number"
            min={0.001}
            max={remaining}
            step="any"
            value={reversedQuantity}
            onChange={(e) => setReversedQuantity(e.target.value)}
          />
        )}
      </Field>
      <Field label="Reason">
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        )}
      </Field>
    </Modal>
  );
}

export default function AssetIssueDetailPage() {
  const { id } = useParams();

  const [issue, setIssue] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [lookups, setLookups] = useState({ items: [], locations: [] });
  const [reversingLine, setReversingLine] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await assetIssuesApi.get(id);
      setIssue(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([itemsApi.list({ limit: 100 }), storageLocationsApi.list({ limit: 100 })])
      .then(([items, locations]) => setLookups({ items: items.data, locations: locations.data }))
      .catch(() => {});
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/inventory/movements" state={{ type: "ISSUE" }} className="font-semibold text-brand-600 hover:underline">
          Back to asset issues
        </Link>
      </div>
    );
  }

  if (!issue) return <Spinner label="Loading asset issue" />;

  const itemName = (itemId) => lookups.items.find((i) => i.id === itemId)?.itemName ?? '—';
  const locationName = (locationId) => lookups.locations.find((l) => l.id === locationId)?.locationName ?? '—';

  const itemColumns = [
    { key: 'itemId', label: 'Item', render: (row) => itemName(row.itemId) },
    { key: 'storageLocationId', label: 'Storage location', render: (row) => locationName(row.storageLocationId) },
    { key: 'issuedQuantity', label: 'Issued', render: (row) => row.issuedQuantity.toLocaleString() },
    { key: 'reversedQuantity', label: 'Reversed', render: (row) => row.reversedQuantity.toLocaleString() },
    { key: 'unitCost', label: 'Unit cost (incl. tax)', render: (row) => row.unitCost.toLocaleString() },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.reversedQuantity < row.issuedQuantity ? (
          <Can resource="ASSET_ISSUE" action="REVERSE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setReversingLine({ ...row, assetIssueId: issue.id })}
            >
              Reverse
            </button>
          </Can>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <Link to="/inventory/movements" state={{ type: "ISSUE" }} className="text-sm font-semibold text-brand-600 hover:underline">
          ← All asset issues
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{issue.issueNumber}</h1>
        <div className="mt-1">
          <StatusBadge status={issue.status} />
        </div>
      </div>

      <Card title="Issue details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Asset">
            <span className="inline-flex items-center gap-1.5">
              <Badge tone={issue.assetType === 'VEHICLE' ? 'neutral' : 'brand'}>{issue.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}</Badge>
              {issue.assetId}
            </span>
          </Detail>
          <Detail label="Issue date">{formatDate(issue.issueDateTime)}</Detail>
          <Detail label="Meter reading">{issue.assetMeterReading != null ? `${issue.assetMeterReading.toLocaleString()} ${issue.meterType ?? ''}` : null}</Detail>
          <Detail label="Issued to">{issue.issuedToPerson}</Detail>
          <Detail label="Purpose">{issue.purpose}</Detail>
          <Detail label="Remarks">{issue.remarks}</Detail>
        </dl>
      </Card>

      <Card title="Items" className="mt-4">
        <Table columns={itemColumns} rows={issue.items} getRowKey={(row) => row.id} emptyMessage="No items on this issue." />
      </Card>

      {issue.reversals?.length > 0 && (
        <Card title="Reversal history" className="mt-4">
          <div className="flex flex-col gap-3">
            {issue.reversals.map((reversal) => (
              <div key={reversal.id} className="border-b border-steel-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-steel-900">{reversal.reversalNumber}</span>
                  <span className="text-steel-500">{formatDate(reversal.reversalDateTime)}</span>
                </div>
                {reversal.reason && <p className="mt-0.5 text-sm text-steel-600">{reversal.reason}</p>}
                <ul className="mt-1 text-sm text-steel-500">
                  {reversal.items.map((line) => (
                    <li key={line.id}>{line.reversedQuantity.toLocaleString()} reversed</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ReverseLineModal
        open={reversingLine !== null}
        line={reversingLine}
        onClose={() => setReversingLine(null)}
        onReversed={async () => {
          setReversingLine(null);
          await load();
        }}
      />
    </div>
  );
}
