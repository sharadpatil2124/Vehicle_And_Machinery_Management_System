import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vehiclesApi, machineryApi, siteAssignmentsApi } from '../../api/client';
import { Alert, Badge, Button, Card, Field, Modal, Select, Spinner } from '../../components/ui';
import Can from '../../components/Can';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-1 text-steel-900">{children ?? <span className="text-steel-400">—</span>}</dd>
    </div>
  );
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Pairs consecutive assignment rows (oldest first) into "moved from X to Y" transfer events. */
function toTransferEvents(history) {
  const chronological = [...history].sort((a, b) => new Date(a.assignedAt) - new Date(b.assignedAt));
  return chronological.map((entry, index) => ({
    id: entry.id,
    fromSiteName: index > 0 ? chronological[index - 1].siteName : null,
    toSiteName: entry.siteName,
    transferredAt: entry.assignedAt,
    transferredByName: entry.assignedByName,
    active: entry.active,
  }));
}

function TransferRow({ event }) {
  return (
    <div className="border-b border-steel-100 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {event.fromSiteName ? (
          <>
            <span className="text-steel-500">{event.fromSiteName}</span>
            <span className="text-steel-400">→</span>
            <span className="font-semibold text-steel-900">{event.toSiteName}</span>
          </>
        ) : (
          <>
            <span className="text-steel-500">Initially assigned to</span>
            <span className="font-semibold text-steel-900">{event.toSiteName}</span>
          </>
        )}
        {event.active && <Badge tone="success">Current</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-steel-500">
        {formatDate(event.transferredAt)}
        {event.transferredByName ? ` · by ${event.transferredByName}` : ''}
      </p>
    </div>
  );
}

function TransferModal({ open, asset, siteOptions, onClose, onConfirm }) {
  const [siteId, setSiteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSiteId('');
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    if (!siteId) {
      setError('Choose a site to transfer to');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(Number(siteId));
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
      title="Transfer to another site"
      description={`Move ${asset ? (asset.assetType === 'VEHICLE' ? asset.registrationNumber : (asset.name ?? asset.assetId)) : ''} to a different site. This closes its current site assignment and starts a new one.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={handleConfirm}>
            Transfer
          </Button>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>
      <Field label="New site" required>
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} describedBy={describedBy} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Select a site</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
                {site.location ? ` — ${site.location}` : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}

export default function SiteAssetDetailPage({ asset, sites, currentSiteId, onTransferred }) {
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    setHistory(null);
    setHistoryError(null);
    siteAssignmentsApi
      .history(asset.assetType, asset.assetId)
      .then((response) => setHistory(response.data))
      .catch((err) => setHistoryError(err.message));
  }, [asset.assetType, asset.assetId]);

  async function handleTransfer(newSiteId) {
    const api = asset.assetType === 'VEHICLE' ? vehiclesApi : machineryApi;
    const response = await api.update(asset.id, { currentSiteId: newSiteId });
    const site = sites.find((s) => s.id === newSiteId);
    setTransferOpen(false);
    onTransferred(`${response.data.assetId} was transferred to ${site?.name ?? 'the selected site'}.`);
  }

  const siteOptions = sites.filter((site) => site.id !== currentSiteId);
  const isVehicle = asset.assetType === 'VEHICLE';
  const detailPath = isVehicle ? `/vehicles/${asset.id}` : `/machinery/${asset.id}`;

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={isVehicle ? asset.registrationNumber : (asset.name ?? asset.assetId)}
        subtitle={asset.assetId}
        actions={
          // Admin only: a Supervisor works at one site and cannot move assets away from it.
          <Can resource="SITE" action="ASSIGN">
            <Button size="sm" onClick={() => setTransferOpen(true)}>
              Transfer to another site
            </Button>
          </Can>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Type">{asset.type}</Detail>
          <Detail label="Fuel type">{asset.fuelType}</Detail>
          {isVehicle ? (
            <>
              <Detail label="Chassis number">{asset.chassisNumber}</Detail>
              <Detail label="Current meter">
                {asset.isHoursBased
                  ? `${Number(asset.currentHours).toLocaleString()} hrs`
                  : `${Number(asset.currentKM).toLocaleString()} KM`}
              </Detail>
            </>
          ) : (
            <>
              <Detail label="Registration number">{asset.registrationNumber}</Detail>
              <Detail label="Current hours">{Number(asset.currentHours).toLocaleString()}</Detail>
            </>
          )}
          <Detail label="Model number">{asset.modelNumber}</Detail>
          <Detail label="Status">
            <div className="flex items-center gap-1.5">
              <Badge tone={asset.status === 'archived' ? 'neutral' : 'success'}>{asset.status}</Badge>
              {asset.isServiceDue && <Badge tone="warning">Service due</Badge>}
            </div>
          </Detail>
        </dl>
        <Link to={detailPath} className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Open full asset page →
        </Link>
      </Card>

      <Card title="Site transfer history">
        {historyError && <Alert tone="error">{historyError}</Alert>}
        {!history ? (
          <Spinner label="Loading transfer history" />
        ) : history.length === 0 ? (
          <p className="text-sm text-steel-400">No transfers recorded yet.</p>
        ) : (
          <div>
            {toTransferEvents(history)
              .slice()
              .reverse()
              .map((event) => (
                <TransferRow key={event.id} event={event} />
              ))}
          </div>
        )}
      </Card>

      <TransferModal
        open={transferOpen}
        asset={asset}
        siteOptions={siteOptions}
        onClose={() => setTransferOpen(false)}
        onConfirm={handleTransfer}
      />
    </div>
  );
}
