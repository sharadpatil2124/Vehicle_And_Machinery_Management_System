import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockTransfersApi, itemsApi, storageLocationsApi, sitesApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useItemIdsInStock from '../../hooks/useItemIdsInStock';

const EMPTY_LINE = { itemId: '', fromStorageLocationId: '', toStorageLocationId: '', quantity: '' };

export default function StockTransferFormPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [form, setForm] = useState({ fromSiteId: '', toSiteId: '', transferDate: '', remarks: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [items, setItems] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [sites, setSites] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveFromSiteId = isAdmin ? form.fromSiteId : String(user?.siteId ?? '');
  const itemIdsInStock = useItemIdsInStock(effectiveFromSiteId);

  useEffect(() => {
    itemsApi.list({ limit: 100 }).then((r) => setItems(r.data)).catch(() => setItems([]));
    storageLocationsApi.list({ limit: 100 }).then((r) => setStorageLocations(r.data)).catch(() => setStorageLocations([]));
    sitesApi.list({ limit: 100 }).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, []);

  const fromLocations = useMemo(
    () => storageLocations.filter((l) => String(l.siteId) === effectiveFromSiteId),
    [storageLocations, effectiveFromSiteId]
  );
  const toLocations = useMemo(
    () => storageLocations.filter((l) => String(l.siteId) === form.toSiteId),
    [storageLocations, form.toSiteId]
  );

  function updateForm(field) {
    return (event) => {
      setForm((f) => ({ ...f, [field]: event.target.value }));
      if (field === 'fromSiteId') setLines([{ ...EMPTY_LINE }]);
    };
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

  const canAddItems = Boolean(effectiveFromSiteId) && Boolean(form.toSiteId);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const filledLines = lines.filter((line) => line.itemId !== '');
    if (filledLines.length === 0) {
      setSubmitError('Add at least one item.');
      return;
    }

    setSubmitting(true);

    const payload = {
      fromSiteId: isAdmin ? Number(form.fromSiteId) : undefined,
      toSiteId: Number(form.toSiteId),
      transferDate: form.transferDate,
      remarks: form.remarks || undefined,
      items: filledLines.map((line) => ({
        itemId: Number(line.itemId),
        fromStorageLocationId: Number(line.fromStorageLocationId),
        toStorageLocationId: Number(line.toStorageLocationId),
        quantity: Number(line.quantity),
      })),
    };

    try {
      const response = await stockTransfersApi.create(payload);
      navigate(`/inventory/stock-transfers/${response.data.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">New stock transfer</h1>
        <p className="mt-1 text-steel-500">
          Nothing moves until the destination site receives it — stock stays at the source until then.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-6 sm:grid-cols-2">
            {isAdmin ? (
              <Field label="From site" required>
                {({ id: fieldId, invalid, describedBy }) => (
                  <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.fromSiteId} onChange={updateForm('fromSiteId')} required>
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
              <Field label="From site" hint="Transfers always dispatch from your own site.">
                {({ id: fieldId }) => <Input id={fieldId} value={sites.find((s) => String(s.id) === effectiveFromSiteId)?.name ?? ''} disabled />}
              </Field>
            )}

            <Field label="To site" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.toSiteId} onChange={updateForm('toSiteId')} required>
                  <option value="">Select a site</option>
                  {sites
                    .filter((site) => String(site.id) !== effectiveFromSiteId)
                    .map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>

            <Field label="Transfer date" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" value={form.transferDate} onChange={updateForm('transferDate')} required />
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
              <Button type="button" variant="secondary" size="sm" onClick={addLine} disabled={!canAddItems}>
                Add item
              </Button>
            </div>

            {!canAddItems ? (
              <p className="text-sm text-steel-400">Select both sites above to choose which items to move.</p>
            ) : fromLocations.length === 0 || toLocations.length === 0 ? (
              <Alert tone="warning">One of these sites has no storage locations yet.</Alert>
            ) : (
              <div className="flex flex-col gap-4">
                {lines.map((line, index) => (
                  <div key={index} className="rounded border border-steel-200 p-3">
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Field label="Item" required>
                        {({ id: fieldId, invalid, describedBy }) => (
                          <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={line.itemId} onChange={updateLine(index, 'itemId')} required>
                            <option value="">Select an item</option>
                            {items
                              .filter((it) => it.status === 'active' && itemIdsInStock.has(it.id))
                              .map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.itemName}
                                </option>
                              ))}
                          </Select>
                        )}
                      </Field>

                      <Field label="Quantity" required>
                        {({ id: fieldId, invalid, describedBy }) => (
                          <Input
                            id={fieldId}
                            invalid={invalid}
                            describedBy={describedBy}
                            type="number"
                            min={0.001}
                            step="any"
                            value={line.quantity}
                            onChange={updateLine(index, 'quantity')}
                            required
                          />
                        )}
                      </Field>

                      <Field label="From storage location" required>
                        {({ id: fieldId, invalid, describedBy }) => (
                          <Select
                            id={fieldId}
                            invalid={invalid}
                            describedBy={describedBy}
                            value={line.fromStorageLocationId}
                            onChange={updateLine(index, 'fromStorageLocationId')}
                            required
                          >
                            <option value="">Select a location</option>
                            {fromLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.locationName}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>

                      <Field label="To storage location" required>
                        {({ id: fieldId, invalid, describedBy }) => (
                          <Select
                            id={fieldId}
                            invalid={invalid}
                            describedBy={describedBy}
                            value={line.toStorageLocationId}
                            onChange={updateLine(index, 'toStorageLocationId')}
                            required
                          >
                            <option value="">Select a location</option>
                            {toLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.locationName}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>

                    {lines.length > 1 && (
                      <button type="button" className="mt-1 text-sm font-semibold text-danger-600 hover:underline" onClick={() => removeLine(index)}>
                        Remove this item
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-5">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!canAddItems}>
              Dispatch transfer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
