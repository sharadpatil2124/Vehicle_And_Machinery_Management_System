import { useCallback, useEffect, useState } from 'react';
import { itemsApi, itemCategoriesApi, unitsOfMeasureApi } from '../../api/client';
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

function ItemForm({ mode, initial, categories, units, onCancel, onSaved }) {
  const [form, setForm] = useState({
    itemName: initial?.itemName ?? '',
    categoryId: initial?.categoryId ?? '',
    baseUomId: initial?.baseUomId ?? '',
    description: initial?.description ?? '',
    itemType: initial?.itemType ?? '',
    isHazardous: initial?.isHazardous ?? false,
    batchTrackingRequired: initial?.batchTrackingRequired ?? false,
    minimumStockLevel: initial?.minimumStockLevel ?? '',
    reorderLevel: initial?.reorderLevel ?? '',
    maximumStockLevel: initial?.maximumStockLevel ?? '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  const updateCheckbox = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.checked }));

  function toOptionalNumber(value) {
    return value === '' ? null : Number(value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        itemName: form.itemName,
        categoryId: Number(form.categoryId),
        baseUomId: Number(form.baseUomId),
        description: form.description || null,
        itemType: form.itemType || null,
        isHazardous: form.isHazardous,
        batchTrackingRequired: form.batchTrackingRequired,
        minimumStockLevel: toOptionalNumber(form.minimumStockLevel),
        reorderLevel: toOptionalNumber(form.reorderLevel),
        maximumStockLevel: toOptionalNumber(form.maximumStockLevel),
      };
      const response =
        mode === 'create' ? await itemsApi.create(payload) : await itemsApi.update(initial.id, payload);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const activeCategories = categories.filter((c) => c.status === 'active');
  const activeUnits = units.filter((u) => u.status === 'active');

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Item name" required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.itemName}
              onChange={update('itemName')}
              maxLength={255}
              required
            />
          )}
        </Field>

        <Field label="Category" required>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.categoryId}
              onChange={update('categoryId')}
              required
            >
              <option value="">Select a category</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.categoryName}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Base unit" required>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.baseUomId}
              onChange={update('baseUomId')}
              required
            >
              <option value="">Select a unit</option>
              {activeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.uomName}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Item type" hint="Optional — e.g. Lubricant, Filter.">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.itemType}
              onChange={update('itemType')}
              maxLength={50}
            />
          )}
        </Field>

        <Field label="Description">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.description}
              onChange={update('description')}
              maxLength={2000}
            />
          )}
        </Field>

        <Field label="Minimum stock level">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="number"
              min={0}
              step="any"
              value={form.minimumStockLevel}
              onChange={update('minimumStockLevel')}
            />
          )}
        </Field>

        <Field label="Reorder level">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="number"
              min={0}
              step="any"
              value={form.reorderLevel}
              onChange={update('reorderLevel')}
            />
          )}
        </Field>

        <Field label="Maximum stock level">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="number"
              min={0}
              step="any"
              value={form.maximumStockLevel}
              onChange={update('maximumStockLevel')}
            />
          )}
        </Field>
      </div>

      <div className="mt-1 mb-4 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-steel-700">
          <input type="checkbox" checked={form.isHazardous} onChange={updateCheckbox('isHazardous')} />
          Hazardous material
        </label>
        <label className="flex items-center gap-2 text-sm text-steel-700">
          <input
            type="checkbox"
            checked={form.batchTrackingRequired}
            onChange={updateCheckbox('batchTrackingRequired')}
          />
          Requires batch/expiry tracking
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create item' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

export default function ItemsPage() {
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await itemsApi.list({
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

  useEffect(() => {
    itemCategoriesApi
      .list({ limit: 100 })
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]));
    unitsOfMeasureApi
      .list({ limit: 100 })
      .then((response) => setUnits(response.data))
      .catch(() => setUnits([]));
  }, []);

  async function handleArchive() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await itemsApi.remove(archiving.id, 'DELETE');
      setArchiving(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletePending(false);
    }
  }

  async function handleRestore(item) {
    setRestoringId(item.id);
    setError(null);
    try {
      await itemsApi.restore(item.id);
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  }

  function categoryName(item) {
    return categories.find((c) => c.id === item.categoryId)?.categoryName ?? '—';
  }
  function uomName(item) {
    return units.find((u) => u.id === item.baseUomId)?.uomName ?? '—';
  }

  const columns = [
    { key: 'itemName', label: 'Name' },
    { key: 'categoryId', label: 'Category', render: categoryName },
    { key: 'baseUomId', label: 'Base unit', render: uomName },
    {
      key: 'flags',
      label: '',
      render: (item) => (
        <div className="flex gap-1.5">
          {item.isHazardous && <Badge tone="danger">Hazardous</Badge>}
          {item.batchTrackingRequired && <Badge tone="brand">Batch tracked</Badge>}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    {
      key: 'actions',
      label: '',
      render: (item) => (
        <div className="flex justify-end gap-3">
          <Can resource="ITEM" action="UPDATE">
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => setFormState(item)}
            >
              Edit
            </button>
          </Can>
          <Can resource="ITEM" action="DELETE">
            {item.status === 'active' && (
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => setArchiving(item)}
              >
                Delete
              </button>
            )}
          </Can>
          <Can resource="ITEM" action="RESTORE">
            {item.status === 'archived' && (
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
                disabled={restoringId === item.id}
                onClick={() => handleRestore(item)}
              >
                {restoringId === item.id ? 'Restoring…' : 'Restore'}
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
          <h1 className="text-xl font-semibold text-steel-900">Items</h1>
          <p className="mt-1 text-steel-500">The catalog of things that can be stocked and issued.</p>
        </div>
        <Can resource="ITEM" action="CREATE">
          <Button onClick={() => setFormState('create')}>Add item</Button>
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
          <Spinner label="Loading items" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(item) => item.id}
              emptyMessage="No items match these filters."
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
        title={formState === 'create' ? 'Add item' : 'Edit item'}
      >
        {formState !== null && (
          <ItemForm
            mode={formState === 'create' ? 'create' : 'edit'}
            initial={formState === 'create' ? null : formState}
            categories={categories}
            units={units}
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
        title="Delete this item?"
        description={`${archiving?.itemName} will be archived and disappear from the item catalog.`}
        onCancel={() => setArchiving(null)}
        onConfirm={handleArchive}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
}
