import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { purchasesApi, suppliersApi, itemsApi, storageLocationsApi, sitesApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const EMPTY_LINE = {
  itemId: '',
  storageLocationId: '',
  purchasedQuantity: '',
  unitPrice: '',
  taxPercentage: '0',
  batchNumber: '',
  expiryDate: '',
};

function toFormValues(purchase) {
  return {
    siteId: purchase.siteId,
    supplierId: purchase.supplierId,
    purchaseDate: purchase.purchaseDate,
    remarks: purchase.remarks ?? '',
  };
}

function toLineValues(items) {
  return items.map((line) => ({
    itemId: line.itemId,
    storageLocationId: line.storageLocationId,
    purchasedQuantity: line.purchasedQuantity,
    unitPrice: line.unitPrice,
    taxPercentage: line.taxPercentage,
    batchNumber: line.batchNumber ?? '',
    expiryDate: line.expiryDate ?? '',
  }));
}

export default function PurchaseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [form, setForm] = useState({ siteId: '', supplierId: '', purchaseDate: '', remarks: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [notEditable, setNotEditable] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveSiteId = isAdmin ? form.siteId : (user?.siteId ?? '');

  useEffect(() => {
    if (!isEdit) return;
    purchasesApi
      .get(id)
      .then((response) => {
        if (response.data.status !== 'draft') {
          setNotEditable(true);
          return;
        }
        setForm(toFormValues(response.data));
        setLines(toLineValues(response.data.items));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    suppliersApi
      .list({ limit: 100 })
      .then((response) => setSuppliers(response.data))
      .catch(() => setSuppliers([]));
    itemsApi
      .list({ limit: 100 })
      .then((response) => setItems(response.data))
      .catch(() => setItems([]));
    storageLocationsApi
      .list({ limit: 100 })
      .then((response) => setStorageLocations(response.data))
      .catch(() => setStorageLocations([]));
    if (isAdmin) {
      sitesApi
        .list({ limit: 100 })
        .then((response) => setSites(response.data))
        .catch(() => setSites([]));
    }
  }, [isAdmin]);

  const locationsAtEffectiveSite = useMemo(
    () => storageLocations.filter((l) => String(l.siteId) === String(effectiveSiteId)),
    [storageLocations, effectiveSiteId]
  );

  function updateForm(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  function updateLine(index, field) {
    return (event) => {
      const value = event.target.value;
      setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
    };
  }

  function addLine() {
    setLines((current) => [...current, { ...EMPTY_LINE }]);
  }

  function removeLine(index) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const filledLines = lines.filter((line) => line.itemId !== '');
    if (filledLines.length === 0) {
      setSubmitError('Add at least one item.');
      return;
    }

    setSubmitting(true);

    const itemsPayload = filledLines.map((line) => ({
      itemId: Number(line.itemId),
      storageLocationId: Number(line.storageLocationId),
      purchasedQuantity: Number(line.purchasedQuantity),
      unitPrice: Number(line.unitPrice),
      taxPercentage: line.taxPercentage === '' ? 0 : Number(line.taxPercentage),
      batchNumber: line.batchNumber || undefined,
      expiryDate: line.expiryDate || undefined,
    }));

    const payload = isEdit
      ? { supplierId: Number(form.supplierId), purchaseDate: form.purchaseDate, remarks: form.remarks || undefined, items: itemsPayload }
      : {
          siteId: isAdmin ? Number(form.siteId) : undefined,
          supplierId: Number(form.supplierId),
          purchaseDate: form.purchaseDate,
          remarks: form.remarks || undefined,
          items: itemsPayload,
        };

    try {
      const response = isEdit ? await purchasesApi.update(id, payload) : await purchasesApi.create(payload);
      navigate(`/inventory/purchases/${response.data.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading purchase" />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  if (notEditable) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">This purchase has already been received and can no longer be edited.</Alert>
        <Link to={`/inventory/purchases/${id}`} className="font-semibold text-brand-600 hover:underline">
          View purchase
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">{isEdit ? 'Edit purchase' : 'New purchase'}</h1>
        <p className="mt-1 text-steel-500">
          {isEdit ? 'Nothing here has been received yet.' : 'Nothing moves into stock until this is received.'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-6 sm:grid-cols-2">
            {isEdit ? (
              <Field label="Site">
                {({ id: fieldId }) => (
                  <Input id={fieldId} value={sites.find((s) => s.id === form.siteId)?.name ?? `Site #${form.siteId}`} disabled />
                )}
              </Field>
            ) : isAdmin ? (
              <Field label="Site" required>
                {({ id: fieldId, invalid, describedBy }) => (
                  <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={updateForm('siteId')} required>
                    <option value="">Select a site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Site" hint="Purchases are always created at your own site.">
                {({ id: fieldId }) => <Input id={fieldId} value={user?.name ? 'Your site' : ''} disabled />}
              </Field>
            )}

            <Field label="Supplier" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.supplierId} onChange={updateForm('supplierId')} required>
                  <option value="">Select a supplier</option>
                  {suppliers
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName}
                      </option>
                    ))}
                </Select>
              )}
            </Field>

            <Field label="Purchase date" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" value={form.purchaseDate} onChange={updateForm('purchaseDate')} required />
              )}
            </Field>

            <Field label="Remarks">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.remarks} onChange={updateForm('remarks')} maxLength={2000} />
              )}
            </Field>
          </div>

          <div className="mt-6 border-t border-steel-200 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-steel-900">Items</h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                Add item
              </Button>
            </div>

            {(!isAdmin || effectiveSiteId) && locationsAtEffectiveSite.length === 0 && (
              <Alert tone="warning">No storage locations exist at this site yet — create one first.</Alert>
            )}

            <div className="flex flex-col gap-4">
              {lines.map((line, index) => (
                <div key={index} className="rounded border border-steel-200 p-3">
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field label="Item" required>
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={line.itemId} onChange={updateLine(index, 'itemId')} required>
                          <option value="">Select an item</option>
                          {items
                            .filter((it) => it.status === 'active')
                            .map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.itemName}
                              </option>
                            ))}
                        </Select>
                      )}
                    </Field>

                    <Field label="Storage location" required>
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Select
                          id={fieldId}
                          invalid={invalid}
                          describedBy={describedBy}
                          value={line.storageLocationId}
                          onChange={updateLine(index, 'storageLocationId')}
                          required
                        >
                          <option value="">Select a location</option>
                          {locationsAtEffectiveSite.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.locationName}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>

                    <Field label="Purchased quantity" required>
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Input
                          id={fieldId}
                          invalid={invalid}
                          describedBy={describedBy}
                          type="number"
                          min={0.001}
                          step="any"
                          value={line.purchasedQuantity}
                          onChange={updateLine(index, 'purchasedQuantity')}
                          required
                        />
                      )}
                    </Field>

                    <Field label="Unit price" required>
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Input
                          id={fieldId}
                          invalid={invalid}
                          describedBy={describedBy}
                          type="number"
                          min={0}
                          step="any"
                          value={line.unitPrice}
                          onChange={updateLine(index, 'unitPrice')}
                          required
                        />
                      )}
                    </Field>

                    <Field label="Tax %">
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Input
                          id={fieldId}
                          invalid={invalid}
                          describedBy={describedBy}
                          type="number"
                          min={0}
                          step="any"
                          value={line.taxPercentage}
                          onChange={updateLine(index, 'taxPercentage')}
                        />
                      )}
                    </Field>

                    <Field label="Batch number">
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={line.batchNumber} onChange={updateLine(index, 'batchNumber')} maxLength={64} />
                      )}
                    </Field>

                    <Field label="Expiry date">
                      {({ id: fieldId, invalid, describedBy }) => (
                        <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" value={line.expiryDate} onChange={updateLine(index, 'expiryDate')} />
                      )}
                    </Field>
                  </div>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="mt-1 text-sm font-semibold text-danger-600 hover:underline"
                      onClick={() => removeLine(index)}
                    >
                      Remove this item
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-5">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Create purchase'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
