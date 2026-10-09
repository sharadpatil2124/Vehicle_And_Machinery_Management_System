import { useCallback, useEffect, useState } from 'react';
import { fuelStationsApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function StationForm({ mode, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    stationName: initial?.stationName ?? '',
    location: initial?.location ?? '',
    phone: initial?.phone ?? '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!form.stationName.trim()) {
      setError('Enter the station name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { stationName: form.stationName, location: form.location || null, phone: form.phone || null };
      if (mode === 'create') await fuelStationsApi.create(payload);
      else await fuelStationsApi.update(initial.id, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <Field label="Station name" required>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} value={form.stationName} onChange={update('stationName')} maxLength={255} />
        )}
      </Field>
      <Field label="Location">
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} value={form.location} onChange={update('location')} maxLength={255} />
        )}
      </Field>
      <Field label="Phone">
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} type="tel" inputMode="tel" value={form.phone} onChange={update('phone')} maxLength={30} />
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Add station' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function FuelStationsPage() {
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await fuelStationsApi.list({
        search: activeFilters.search || undefined,
        status: activeFilters.status || undefined,
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

  async function handleArchive() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await fuelStationsApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(station) {
    setRestoringId(station.id);
    setError(null);
    try {
      await fuelStationsApi.restore(station.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    { key: 'stationName', label: 'Station' },
    { key: 'location', label: 'Location', render: (s) => s.location ?? '—' },
    { key: 'phone', label: 'Phone', render: (s) => s.phone ?? '—' },
    { key: 'status', label: 'Status', render: (s) => <Badge tone={s.status === 'archived' ? 'neutral' : 'success'}>{s.status}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (s) => (
        <div className="flex justify-end gap-3">
          <Can resource="FUEL_STATION" action="UPDATE">
            <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setFormState(s)}>
              Edit
            </button>
          </Can>
          <Can resource="FUEL_STATION" action="DELETE">
            {s.status === 'active' && (
              <button type="button" className="font-semibold text-danger-600 hover:underline" onClick={() => setArchiving(s)}>
                Delete
              </button>
            )}
          </Can>
          <Can resource="FUEL_STATION" action="RESTORE">
            {s.status === 'archived' && (
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
                disabled={restoringId === s.id}
                onClick={() => handleRestore(s)}
              >
                {restoringId === s.id ? 'Restoring…' : 'Restore'}
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
          <h1 className="text-xl font-semibold text-steel-900">Fuel Stations</h1>
          <p className="mt-1 text-steel-500">The pumps your carrier vehicles buy fuel from.</p>
        </div>
        <Can resource="FUEL_STATION" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add station</Button>
        </Can>
      </div>

      <Alert tone="error">{error}</Alert>

      <div className="mb-4 grid gap-3 sm:max-w-md sm:grid-cols-2">
        <Input
          placeholder="Search by name..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
        />
        <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          <Spinner label="Loading fuel stations" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(s) => s.id} emptyMessage="No fuel stations yet. Add the pumps your carriers use." />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>

      <Modal open={formState !== null} onClose={() => setFormState(null)} title={formState === 'create' ? 'Add fuel station' : 'Edit fuel station'}>
        {formState !== null && (
          <StationForm
            mode={formState === 'create' ? 'create' : 'edit'}
            initial={formState === 'create' ? null : formState}
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
        title="Delete this fuel station?"
        description={`${archiving?.stationName} will be archived. Past collections keep showing its name.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
