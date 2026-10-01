import { useCallback, useEffect, useState } from 'react';
import { unitsOfMeasureApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function StatusBadge({ status }) {
  return <Badge tone={status === 'archived' ? 'neutral' : 'success'}>{status}</Badge>;
}

function UnitForm({ mode, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    uomName: initial?.uomName ?? '',
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
        uomName: form.uomName,
      };
      const response =
        mode === 'create'
          ? await unitsOfMeasureApi.create(payload)
          : await unitsOfMeasureApi.update(initial.id, payload);
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

      <Field label="Unit name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.uomName}
            onChange={update('uomName')}
            maxLength={150}
            required
          />
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create unit' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function UnitsOfMeasurePage() {
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
      const response = await unitsOfMeasureApi.list({
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
      await unitsOfMeasureApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(unit) {
    setRestoringId(unit.id);
    setError(null);
    try {
      await unitsOfMeasureApi.restore(unit.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    { key: 'uomName', label: 'Name' },
    { key: 'status', label: 'Status', render: (u) => <StatusBadge status={u.status} /> },
    {
      key: 'actions',
      label: '',
      render: (u) => (
        <div className="flex justify-end gap-3">
          <Can resource="UOM" action="UPDATE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setFormState(u)}
            >
              Edit
            </button>
          </Can>
          <Can resource="UOM" action="DELETE">
            {u.status === 'active' && (
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => setArchiving(u)}
              >
                Delete
              </button>
            )}
          </Can>
          <Can resource="UOM" action="RESTORE">
            {u.status === 'archived' && (
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
                disabled={restoringId === u.id}
                onClick={() => handleRestore(u)}
              >
                {restoringId === u.id ? 'Restoring…' : 'Restore'}
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
          <h1 className="text-xl font-semibold text-steel-900">Units of Measure</h1>
          <p className="mt-1 text-steel-500">The units items are stocked and issued in.</p>
        </div>
        <Can resource="UOM" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add unit</Button>
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
          <Spinner label="Loading units of measure" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(u) => u.id}
              emptyMessage="No units match these filters."
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
        title={formState === 'create' ? 'Add unit' : 'Edit unit'}
      >
        {formState !== null && (
          <UnitForm
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
        title="Delete this unit?"
        description={`${archiving?.uomName} will be archived and disappear from the unit list. This is blocked while any active item still uses it as its base unit.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
