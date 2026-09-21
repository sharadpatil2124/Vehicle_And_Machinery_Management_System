import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { vehiclesApi, sitesApi } from '../api/client';
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

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
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
      const response = await vehiclesApi.get(id);
      setVehicle(response.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!vehicle?.currentSiteId) {
      setSiteName(null);
      return;
    }
    sitesApi
      .get(vehicle.currentSiteId)
      .then((response) => setSiteName(response.data.name))
      .catch(() => setSiteName(null));
  }, [vehicle?.currentSiteId]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await vehiclesApi.remove(id, 'DELETE');
      navigate('/vehicles');
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
      await vehiclesApi.restore(id);
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
        <Link to="/vehicles" className="font-semibold text-brand-600 hover:underline">
          Back to vehicles
        </Link>
      </div>
    );
  }

  if (!vehicle) return <Spinner label="Loading vehicle" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/vehicles" className="text-sm font-semibold text-brand-600 hover:underline">
            ← All vehicles
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-steel-900">{vehicle.registrationNumber}</h1>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge tone={vehicle.status === 'archived' ? 'neutral' : 'success'}>{vehicle.status}</Badge>
            {vehicle.isServiceDue && <Badge tone="warning">Service due</Badge>}
          </div>
        </div>

        {vehicle.status === 'active' ? (
          <div className="flex gap-2">
            <Can resource="VEHICLE" action="UPDATE">
              <Button as={Link} to={`/vehicles/${vehicle.id}/edit`} variant="secondary">
                Edit
              </Button>
            </Can>
            <Can resource="VEHICLE" action="DELETE">
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            </Can>
          </div>
        ) : (
          <Can resource="VEHICLE" action="RESTORE">
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore'}
              </Button>
              {restoreError && <p className="text-sm text-danger-600">{restoreError}</p>}
            </div>
          </Can>
        )}
      </div>

      <Card title="Vehicle details">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Asset ID">{vehicle.assetId}</Detail>
          <Detail label="Registration number">{vehicle.registrationNumber}</Detail>
          <Detail label="Type">{vehicle.type}</Detail>
          <Detail label="Fuel type">{vehicle.fuelType}</Detail>
          <Detail label="Year">{vehicle.year}</Detail>
          <Detail label="Model number">{vehicle.modelNumber}</Detail>
          <Detail label="Chassis number">{vehicle.chassisNumber}</Detail>
          <Detail label="Current site">{siteName ?? (vehicle.currentSiteId ? '—' : 'Not assigned')}</Detail>
          {vehicle.isHoursBased ? (
            <>
              <Detail label="Current hours">{Number(vehicle.currentHours).toLocaleString()}</Detail>
              <Detail label="Service interval (hours)">
                {Number(vehicle.serviceIntervalHours).toLocaleString()}
              </Detail>
              <Detail label="Next service due at">
                {Number(vehicle.nextServiceHours).toLocaleString()} hrs
              </Detail>
            </>
          ) : (
            <>
              <Detail label="Current KM">{Number(vehicle.currentKM).toLocaleString()}</Detail>
              <Detail label="Service interval (KM)">
                {Number(vehicle.serviceIntervalKM).toLocaleString()}
              </Detail>
              <Detail label="Next service due at">
                {Number(vehicle.nextServiceKM).toLocaleString()} KM
              </Detail>
            </>
          )}
          <Detail label="Created">{formatDate(vehicle.createdAt)}</Detail>
          <Detail label="Last updated">{formatDate(vehicle.updatedAt)}</Detail>
          {vehicle.status === 'archived' && (
            <Detail label="Archived">{formatDate(vehicle.archivedAt)}</Detail>
          )}
        </dl>
      </Card>

      <AssetDocumentsCard assetType="VEHICLE" assetId={vehicle.assetId} />

      <DeleteWordModal
        open={confirmingDelete}
        title="Delete this vehicle?"
        description={`${vehicle.registrationNumber} will be archived. It disappears from the fleet list, but its history is preserved and it can be restored later from this page.`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        pending={deleting}
        error={deleteError}
      />
    </div>
  );
}
