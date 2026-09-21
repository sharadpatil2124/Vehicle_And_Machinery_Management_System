import { useCallback, useEffect, useState } from 'react';
import { sitesApi } from '../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../components/ui';
import Can from '../components/Can';
import DeleteWordModal from '../components/DeleteWordModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function StatusBadge({ status }) {
  return <Badge tone={status === 'archived' ? 'neutral' : 'success'}>{status}</Badge>;
}

function SiteForm({ mode, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    location: initial?.location ?? '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response =
        mode === 'create' ? await sitesApi.create(form) : await sitesApi.update(initial.id, form);
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

      <Field label="Name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.name}
            onChange={update('name')}
            maxLength={150}
            required
          />
        )}
      </Field>

      <Field label="Location">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.location}
            onChange={update('location')}
            maxLength={255}
          />
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create site' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function SitesPage() {
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
      const response = await sitesApi.list({
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
      await sitesApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(site) {
    setRestoringId(site.id);
    setError(null);
    try {
      await sitesApi.restore(site.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'location', label: 'Location', render: (s) => s.location ?? '—' },
    { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      label: '',
      render: (s) => (
        <div className="flex justify-end gap-3">
          <Can resource="SITE" action="UPDATE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setFormState(s)}
            >
              Edit
            </button>
          </Can>
          <Can resource="SITE" action="DELETE">
            {s.status === 'active' && (
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => setArchiving(s)}
              >
                Delete
              </button>
            )}
          </Can>
          <Can resource="SITE" action="RESTORE">
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
          <h1 className="text-xl font-semibold text-steel-900">Sites</h1>
          <p className="mt-1 text-steel-500">Locations a vehicle or machine can be assigned to.</p>
        </div>
        <Can resource="SITE" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add site</Button>
        </Can>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 sm:max-w-md">
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
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          <Spinner label="Loading sites" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(s) => s.id}
              emptyMessage="No sites match these filters."
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
        title={formState === 'create' ? 'Add site' : 'Edit site'}
      >
        {formState !== null && (
          <SiteForm
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
        title="Delete this site?"
        description={`${archiving?.name} will be archived and disappear from the site list. Assets currently assigned to it keep their assignment.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
