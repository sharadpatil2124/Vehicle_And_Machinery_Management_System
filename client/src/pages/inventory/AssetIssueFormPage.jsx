import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetIssuesApi, vehiclesApi, machineryApi, itemsApi, stockApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, machineryLabel } from '../../config/fuel';

const EMPTY_LINE = { itemId: '', issuedQuantity: '' };

const LINE_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[1.5rem_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] sm:items-center sm:gap-y-0';

// Value of issuing `quantity` from this stock: oldest batches go first, the same way the server prices the issue.
// Returns null when the quantity is empty or more than what is in stock.
function issueValue(balance, quantity) {
  if (!balance || !(quantity > 0)) return null;
  let left = quantity;
  let total = 0;
  for (const batch of balance.batches ?? []) {
    if (left <= 0) break;
    const take = Math.min(batch.remainingQuantity, left);
    total += take * batch.unitCost;
    left -= take;
  }
  if (left > 1e-9) return null;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function CellLabel({ htmlFor, required = false, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-steel-600 sm:sr-only">
      {children}
      {required && <span className="ml-0.5 text-danger-600">*</span>}
    </label>
  );
}

function assetLabel(assetType, asset) {
  return assetType === 'VEHICLE' ? asset.registrationNumber : machineryLabel(asset);
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
  });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);

  const [vehicles, setVehicles] = useState(null);
  const [machinery, setMachinery] = useState(null);
  const [items, setItems] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    if (!form.siteId) {
      setBalances([]);
      return undefined;
    }
    let cancelled = false;
    listAll(stockApi.balances, { siteId: form.siteId })
      .then((r) => {
        if (!cancelled) setBalances(r.data.filter((b) => b.availableQuantity > 0));
      })
      .catch(() => {
        if (!cancelled) setBalances([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.siteId]);

  const balanceByItemId = useMemo(() => new Map(balances.map((b) => [b.itemId, b])), [balances]);
  const itemIdsInStock = useMemo(() => new Set(balances.map((b) => b.itemId)), [balances]);

  useEffect(() => {
    listAll(vehiclesApi.list).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    listAll(machineryApi.list, { sort: 'rcpl:asc' }).then((r) => setMachinery(r.data)).catch(() => setMachinery([]));
    listAll(itemsApi.list).then((r) => setItems(r.data)).catch(() => setItems([]));
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
      items: filledLines.map((line) => ({
        itemId: Number(line.itemId),
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
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">New asset issue</h1>
        <p className="mt-1 text-steel-500">Stock decreases immediately — there's no separate confirm step.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
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
                    <option key={siteId} value={siteId} data-added={siteId}>
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
                      <option key={a.assetId} value={a.assetId} data-added={a.id}>
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
          </div>

          <div className="mt-4 border-t border-steel-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-steel-900">Items</h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLine} disabled={!selectedAsset}>
                Add item
              </Button>
            </div>

            {!selectedAsset ? (
              <p className="text-sm text-steel-400">Select an asset above to choose which items to issue.</p>
            ) : (
              <div>
                <div
                  aria-hidden="true"
                  className={`${LINE_GRID} hidden border-b border-steel-200 pb-2 text-xs font-semibold tracking-wide text-steel-500 uppercase sm:grid`}
                >
                  <span>#</span>
                  <span>
                    Item<span className="ml-0.5 text-danger-600">*</span>
                  </span>
                  <span className="text-right">
                    Issued quantity<span className="ml-0.5 text-danger-600">*</span>
                  </span>
                  <span className="text-right">Total value</span>
                  <span />
                </div>

                <div className="border-t border-steel-200 sm:border-t-0">
                  {lines.map((line, index) => {
                    const rowId = `issue-line-${index}`;
                    return (
                      <div key={index} className={`${LINE_GRID} border-b border-steel-100 py-3 sm:py-1.5`}>
                        <span className="col-start-1 row-start-1 self-center text-sm font-semibold text-steel-500 tabular-nums sm:col-start-auto sm:row-start-auto">
                          <span className="sm:hidden">Item </span>
                          {index + 1}
                        </span>

                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <CellLabel htmlFor={`${rowId}-item`} required>
                            Item
                          </CellLabel>
                          <Select id={`${rowId}-item`} aria-label={`Item ${index + 1}`} value={line.itemId} onChange={updateLine(index, 'itemId')} required>
                            <option value="">Select an item</option>
                            {items
                              .filter((it) => it.status === 'active' && itemIdsInStock.has(it.id))
                              .map((it) => (
                                <option key={it.id} value={it.id} data-added={it.id}>
                                  {it.itemName}
                                </option>
                              ))}
                          </Select>
                        </div>

                        <div className="min-w-0">
                          <CellLabel htmlFor={`${rowId}-quantity`} required>
                            Issued quantity
                          </CellLabel>
                          <Input
                            id={`${rowId}-quantity`}
                            aria-label={`Issued quantity for item ${index + 1}`}
                            className="text-right tabular-nums"
                            type="number"
                            min={0.001}
                            step="any"
                            inputMode="decimal"
                            value={line.issuedQuantity}
                            onChange={updateLine(index, 'issuedQuantity')}
                            required
                          />
                        </div>

                        <div className="min-w-0 text-right sm:self-center">
                          <span className="mb-1 block text-xs font-semibold text-steel-600 sm:sr-only">Total value</span>
                          {(() => {
                            const quantity = Number(line.issuedQuantity);
                            if (line.itemId === '' || !(quantity > 0)) return <span className="text-steel-400">—</span>;
                            const value = issueValue(balanceByItemId.get(Number(line.itemId)), quantity);
                            if (value === null) {
                              return <span className="text-sm font-semibold text-danger-600">Exceeds stock</span>;
                            }
                            return <span className="font-semibold text-steel-900 tabular-nums">{formatCurrency(value)}</span>;
                          })()}
                        </div>

                        <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove item ${index + 1}`}
                              title="Remove this item"
                              className="rounded px-2 py-1 text-sm font-semibold text-danger-600 hover:bg-danger-50"
                              onClick={() => removeLine(index)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
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
