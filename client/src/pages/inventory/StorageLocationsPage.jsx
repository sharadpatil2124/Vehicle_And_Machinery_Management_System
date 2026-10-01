import { useCallback, useEffect, useState } from 'react';
import { storageLocationsApi, sitesApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import useSiteNames from '../../hooks/useSiteNames';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function StatusBadge({ status }) {
  return <Badge tone={status === 'archived' ? 'neutral' : 'success'}>{status}</Badge>;
}

function StorageLocationForm({ mode, initial, sites, onCancel, onSaved }) {
  const [form, setForm] = useState({
    siteId: initial?.siteId ?? '',
    locationName: initial?.locationName ?? '',
    locationType: initial?.locationType ?? '',
    capacity: initial?.capacity ?? '',
    capacityUom: initial?.capacityUom ?? '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        siteId: Number(form.siteId),
        locationName: form.locationName,
        locationType: form.locationType || null,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        capacityUom: form.capacityUom || null,
      };
      const response =
        mode === 'create'
          ? await storageLocationsApi.create(payload)
          : await storageLocationsApi.update(initial.id, payload);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <Field label="Site" required>
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={update('siteId')} required>
            <option value="">Select a site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Location name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.locationName}
            onChange={update('locationName')}
            maxLength={150}
            required
          />
        )}
      </Field>

      <Field label="Location type" hint="Optional — e.g. Warehouse, Fuel Yard.">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.locationType}
            onChange={update('locationType')}
            maxLength={50}
          />
        )}
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Capacity">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="number"
              min={0}
              step="any"
              value={form.capacity}
              onChange={update('capacity')}
            />
          )}
        </Field>

        <Field label="Capacity unit" hint="Free text, e.g. Litres.">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.capacityUom}
              onChange={update('capacityUom')}
              maxLength={32}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create location' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function StorageLocationsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [filters, setFilters] = useState({ search: '', status: '', siteId: '', page: 1 });
  const [result, setResult] = useState(null);
  const [sites, setSites] = useState([]);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const siteNames = useSiteNames();

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await storageLocationsApi.list({
        search: activeFilters.search || undefined,
        status: activeFilters.status || undefined,
        siteId: activeFilters.siteId || undefined,
        page: activeFilters.page,
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  useEffect(() => {
    if (!isAdmin) return;
    sitesApi
      .list({ limit: 100 })
      .then((response) => setSites(response.data))
      .catch(() => setSites([]));
  }, [isAdmin]);

  async function handleArchive() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await storageLocationsApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(location) {
    setRestoringId(location.id);
    setError(null);
    try {
      await storageLocationsApi.restore(location.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    { key: 'locationName', label: 'Name' },
    { key: 'locationType', label: 'Type', render: (l) => l.locationType ?? '—' },
    { key: 'siteId', label: 'Site', render: (l) => siteNames[l.siteId] ?? '—' },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (l) => (l.capacity == null ? '—' : `${l.capacity.toLocaleString()} ${l.capacityUom ?? ''}`.trim()),
    },
    { key: 'status', label: 'Status', render: (l) => <StatusBadge status={l.status} /> },
    {
      key: 'actions',
      label: '',
      render: (l) => (
        <div className="flex justify-end gap-3">
          <Can resource="STORAGE_LOCATION" action="UPDATE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setFormState(l)}
            >
              Edit
            </button>
          </Can>
          <Can resource="STORAGE_LOCATION" action="DELETE">
            {l.status === 'active' && (
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => setArchiving(l)}
              >
                Delete
              </button>
            )}
          </Can>
          <Can resource="STORAGE_LOCATION" action="RESTORE">
            {l.status === 'archived' && (
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
                disabled={restoringId === l.id}
                onClick={() => handleRestore(l)}
              >
                {restoringId === l.id ? 'Restoring…' : 'Restore'}
              </button>
            )}
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Storage Locations</h1>
          <p className="mt-1 text-steel-500">
            {isAdmin
              ? 'Where stock physically sits within each site.'
              : 'Where stock physically sits at your site.'}
          </p>
        </div>
        <Can resource="STORAGE_LOCATION" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add location</Button>
        </Can>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={`mb-4 grid gap-3 ${isAdmin ? 'sm:grid-cols-3 sm:max-w-2xl' : 'sm:grid-cols-2 sm:max-w-md'}`}>
        <Input
          placeholder="Search by name..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        { }
        {isAdmin && (
          <Select
            value={filters.siteId}
            onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value, page: 1 }))}
          >
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          <Spinner label="Loading storage locations" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(l) => l.id}
              emptyMessage="No storage locations match these filters."
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>

      <Modal
        open={formState !== null}
        onClose={() => setFormState(null)}
        title={formState === 'create' ? 'Add storage location' : 'Edit storage location'}
      >
        {formState !== null && (
          <StorageLocationForm
            mode={formState === 'create' ? 'create' : 'edit'}
            initial={formState === 'create' ? null : formState}
            sites={sites}
            onCancel={() => setFormState(null)}
            onSaved={async () => {
              setFormState(null);
              await load(filters);
            }}
          />
        )}
      </Modal>

      <DeleteWordModal
        open={archiving !== null}
        title="Delete this storage location?"
        description={`${archiving?.locationName} will be archived and disappear from the location list.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
