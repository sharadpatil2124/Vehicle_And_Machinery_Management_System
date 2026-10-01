import { useCallback, useEffect, useState } from 'react';
import { itemCategoriesApi } from '../../api/client';
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

function CategoryForm({ mode, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    categoryName: initial?.categoryName ?? '',
    inventoryType: initial?.inventoryType ?? '',
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
        categoryName: form.categoryName,
        inventoryType: form.inventoryType || null,
      };
      const response =
        mode === 'create'
          ? await itemCategoriesApi.create(payload)
          : await itemCategoriesApi.update(initial.id, payload);
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

      <Field label="Category name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.categoryName}
            onChange={update('categoryName')}
            maxLength={150}
            required
          />
        )}
      </Field>

      <Field label="Inventory type" hint="Optional — e.g. Consumable, Spare Part.">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            value={form.inventoryType}
            onChange={update('inventoryType')}
            maxLength={50}
          />
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create category' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function ItemCategoriesPage() {
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
      const response = await itemCategoriesApi.list({
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
      await itemCategoriesApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(category) {
    setRestoringId(category.id);
    setError(null);
    try {
      await itemCategoriesApi.restore(category.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    { key: 'categoryName', label: 'Name' },
    { key: 'inventoryType', label: 'Inventory type', render: (c) => c.inventoryType ?? '—' },
    { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      label: '',
      render: (c) => (
        <div className="flex justify-end gap-3">
          <Can resource="ITEM_CATEGORY" action="UPDATE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setFormState(c)}
            >
              Edit
            </button>
          </Can>
          <Can resource="ITEM_CATEGORY" action="DELETE">
            {c.status === 'active' && (
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => setArchiving(c)}
              >
                Delete
              </button>
            )}
          </Can>
          <Can resource="ITEM_CATEGORY" action="RESTORE">
            {c.status === 'archived' && (
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
                disabled={restoringId === c.id}
                onClick={() => handleRestore(c)}
              >
                {restoringId === c.id ? 'Restoring…' : 'Restore'}
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
          <h1 className="text-xl font-semibold text-steel-900">Item Categories</h1>
          <p className="mt-1 text-steel-500">Groups for organizing the item catalog.</p>
        </div>
        <Can resource="ITEM_CATEGORY" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add category</Button>
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
          <Spinner label="Loading item categories" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(c) => c.id}
              emptyMessage="No item categories match these filters."
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
        title={formState === 'create' ? 'Add category' : 'Edit category'}
      >
        {formState !== null && (
          <CategoryForm
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
        title="Delete this category?"
        description={`${archiving?.categoryName} will be archived and disappear from the category list. This is blocked while any active item still uses it.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
