import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetIssuesApi, vehiclesApi, machineryApi, itemsApi, storageLocationsApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import useItemIdsInStock from '../../hooks/useItemIdsInStock';

const EMPTY_LINE = { itemId: '', storageLocationId: '', issuedQuantity: '' };

function assetLabel(assetType, asset) {
  return assetType === 'VEHICLE' ? asset.registrationNumber : (asset.name ?? asset.assetId);
}

export default function AssetIssueFormPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [form, setForm] = useState({
    siteId: isAdmin ? '' : String(user?.siteId ?? ''),
    assetType: 'VEHICLE',
    assetId: '',
    assetMeterReading: '',
    issuedToPerson: '',
    purpose: '',
    remarks: '',
  });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);

  const [vehicles, setVehicles] = useState(null);
  const [machinery, setMachinery] = useState(null);
  const [items, setItems] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const itemIdsInStock = useItemIdsInStock(form.siteId);

  useEffect(() => {
    vehiclesApi.list({ limit: 100 }).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    machineryApi.list({ limit: 100 }).then((r) => setMachinery(r.data)).catch(() => setMachinery([]));
    itemsApi.list({ limit: 100 }).then((r) => setItems(r.data)).catch(() => setItems([]));
    storageLocationsApi.list({ limit: 100 }).then((r) => setStorageLocations(r.data)).catch(() => setStorageLocations([]));
  }, []);

  const assetOptions = useMemo(() => {
    const source = form.assetType === 'VEHICLE' ? vehicles : machinery;
    if (!source || !form.siteId) return source ? [] : null;
    return source.filter((a) => String(a.currentSiteId) === String(form.siteId));
  }, [vehicles, machinery, form.assetType, form.siteId]);

  const selectedAsset = useMemo(
    () => (assetOptions ?? []).find((a) => a.assetId === form.assetId) ?? null,
    [assetOptions, form.assetId]
  );

  const locationsAtAssetSite = useMemo(
    () => storageLocations.filter((l) => l.siteId === selectedAsset?.currentSiteId),
    [storageLocations, selectedAsset]
  );

  function updateForm(field) {
    return (event) => {
      const value = event.target.value;
      setForm((f) =>
        field === 'assetType' || field === 'siteId' ? { ...f, [field]: value, assetId: '' } : { ...f, [field]: value }
      );
      if (field === 'siteId') setLines([{ ...EMPTY_LINE }]);
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
      assetType: form.assetType,
      assetId: form.assetId,
      assetMeterReading: form.assetMeterReading === '' ? undefined : Number(form.assetMeterReading),
      issuedToPerson: form.issuedToPerson || undefined,
      purpose: form.purpose || undefined,
      remarks: form.remarks || undefined,
      items: filledLines.map((line) => ({
        itemId: Number(line.itemId),
        storageLocationId: Number(line.storageLocationId),
        issuedQuantity: Number(line.issuedQuantity),
      })),
    };

    try {
      const response = await assetIssuesApi.create(payload);
      navigate(`/inventory/asset-issues/${response.data.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (vehicles === null || machinery === null) return <Spinner label="Loading assets" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">New asset issue</h1>
        <p className="mt-1 text-steel-500">Stock decreases immediately — there's no separate confirm step.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field label="Site" required hint={!isAdmin ? 'Assets at your own site.' : undefined}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.siteId}
                  onChange={updateForm('siteId')}
                  disabled={!isAdmin}
                  required
                >
                  {isAdmin && <option value="">Select a site</option>}
                  {Object.entries(siteNames).map(([siteId, name]) => (
                    <option key={siteId} value={siteId}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Asset type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.assetType} onChange={updateForm('assetType')} required>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="MACHINERY">Machinery</option>
                </Select>
              )}
            </Field>

            <Field
              label={form.assetType === 'VEHICLE' ? 'Vehicle' : 'Machine'}
              required
              hint={!form.siteId ? 'Select a site first.' : undefined}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.assetId}
                  onChange={updateForm('assetId')}
                  disabled={!form.siteId}
                  required
                >
                  <option value="">{form.siteId ? 'Select an asset' : 'Select a site first'}</option>
                  {(assetOptions ?? [])
                    .filter((a) => a.status === 'active')
                    .map((a) => (
                      <option key={a.assetId} value={a.assetId}>
                        {assetLabel(form.assetType, a)} ({a.assetId})
                      </option>
                    ))}
                </Select>
              )}
            </Field>

            <Field label="Asset meter reading" hint={selectedAsset ? undefined : 'Select an asset first.'}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={0}
                  step="any"
                  value={form.assetMeterReading}
                  onChange={updateForm('assetMeterReading')}
                />
              )}
            </Field>

            <Field label="Issued to">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.issuedToPerson} onChange={updateForm('issuedToPerson')} maxLength={150} />
              )}
            </Field>

            <Field label="Purpose">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.purpose} onChange={updateForm('purpose')} maxLength={255} />
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
              <Button type="button" variant="secondary" size="sm" onClick={addLine} disabled={!selectedAsset}>
                Add item
              </Button>
            </div>

            {!selectedAsset ? (
              <p className="text-sm text-steel-400">Select an asset above to choose which items to issue.</p>
            ) : locationsAtAssetSite.length === 0 ? (
              <Alert tone="warning">No storage locations exist at this asset's site yet.</Alert>
            ) : (
              <div className="flex flex-col gap-4">
                {lines.map((line, index) => (
                  <div key={index} className="rounded border border-steel-200 p-3">
                    <div className="grid gap-x-4 sm:grid-cols-3">
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
                            {locationsAtAssetSite.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.locationName}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>

                      <Field label="Issued quantity" required>
                        {({ id: fieldId, invalid, describedBy }) => (
                          <Input
                            id={fieldId}
                            invalid={invalid}
                            describedBy={describedBy}
                            type="number"
                            min={0.001}
                            step="any"
                            value={line.issuedQuantity}
                            onChange={updateLine(index, 'issuedQuantity')}
                            required
                          />
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
            <Button type="submit" loading={submitting} disabled={!selectedAsset}>
              Create issue
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
