import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { machineryApi, sitesApi } from '../api/client';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui';
import Can from '../components/Can';
import DeleteWordModal from '../components/DeleteWordModal';
import AssetDocumentsCard from '../components/AssetDocumentsCard';

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

export default function MachineryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [machine, setMachine] = useState(null);
  const [siteName, setSiteName] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await machineryApi.get(id);
      setMachine(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!machine?.currentSiteId) {
      setSiteName(null);
      return;
    }
    sitesApi
      .get(machine.currentSiteId)
      .then((response) => setSiteName(response.data.name))
      .catch(() => setSiteName(null));
  }, [machine?.currentSiteId]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await machineryApi.remove(id, 'DELETE');
      navigate('/machinery');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setRestoreError(null);
    try {
      await machineryApi.restore(id);
      await load();
    } catch (err) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/machinery" className="font-semibold text-brand-600 hover:underline">
          Back to machinery
        </Link>
      </div>
    );
  }

  if (!machine) return <Spinner label="Loading machine" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/machinery" className="text-sm font-semibold text-brand-600 hover:underline">
            ← All machinery
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{machine.assetId}</h1>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge tone={machine.status === 'archived' ? 'neutral' : 'success'}>{machine.status}</Badge>
            {machine.isServiceDue && <Badge tone="warning">Service due</Badge>}
          </div>
        </div>

        {machine.status === 'active' ? (
          <div className="flex gap-2">
            <Can resource="MACHINERY" action="UPDATE">
              <Button as={Link} to={`/machinery/${machine.id}/edit`} variant="secondary">
                Edit
              </Button>
            </Can>
            <Can resource="MACHINERY" action="DELETE">
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            </Can>
          </div>
        ) : (
          <Can resource="MACHINERY" action="RESTORE">
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore'}
              </Button>
              {restoreError && <p className="text-sm text-danger-600">{restoreError}</p>}
            </div>
          </Can>
        )}
      </div>

      <Card title="Machine details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Asset ID">{machine.assetId}</Detail>
          <Detail label="Machinery name">{machine.name}</Detail>
          <Detail label="Registration number">{machine.registrationNumber}</Detail>
          <Detail label="Type">{machine.type}</Detail>
          <Detail label="Fuel type">{machine.fuelType}</Detail>
          <Detail label="Year">{machine.year}</Detail>
          <Detail label="Model number">{machine.modelNumber}</Detail>
          <Detail label="Chassis number">{machine.serialNumber}</Detail>
          <Detail label="Current site">{siteName ?? (machine.currentSiteId ? '—' : 'Not assigned')}</Detail>
          <Detail label="Current hours">{Number(machine.currentHours).toLocaleString()}</Detail>
          <Detail label="Service interval (hours)">
            {Number(machine.serviceIntervalHours).toLocaleString()}
          </Detail>
          <Detail label="Next service due at">
            {Number(machine.nextServiceHours).toLocaleString()} hrs
          </Detail>
          <Detail label="Created">{formatDate(machine.createdAt)}</Detail>
          <Detail label="Last updated">{formatDate(machine.updatedAt)}</Detail>
          {machine.status === 'archived' && (
            <Detail label="Archived">{formatDate(machine.archivedAt)}</Detail>
          )}
        </dl>
      </Card>

      <AssetDocumentsCard assetType="MACHINERY" assetId={machine.assetId} />

      <DeleteWordModal
        open={confirmingDelete}
        title="Delete this machine?"
        description={`${machine.assetId} will be archived. It disappears from the fleet list, but its history is preserved and it can be restored later from this page.`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        pending={deleting}
        error={deleteError}
      />
    </div>
  );
}
