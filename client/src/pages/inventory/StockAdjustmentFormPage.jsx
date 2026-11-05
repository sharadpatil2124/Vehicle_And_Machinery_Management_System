import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAdjustmentsApi, itemsApi, sitesApi, stockApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useItemIdsInStock from '../../hooks/useItemIdsInStock';
import { todayDateOnly } from '../../config/fuel';

const EMPTY_LINE = { itemId: '', countedQuantity: '' };

function AdjustmentLine({ line, index, items, siteId, onChange, onRemove, canRemove }) {
  const [currentQuantity, setCurrentQuantity] = useState(null);

  useEffect(() => {
    if (!line.itemId) {
      setCurrentQuantity(null);
      return undefined;
    }
    let cancelled = false;
    stockApi
      .balances({ itemId: line.itemId, siteId: siteId || undefined, limit: 1 })
      .then((response) => {
        if (!cancelled) setCurrentQuantity(response.data[0]?.quantityOnHand ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCurrentQuantity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [line.itemId, siteId]);

  function update(field) {
    return (event) => onChange(index, field, event.target.value);
  }

  return (
    <div className="rounded border border-steel-200 p-3">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Item" required>
          {({ id: fieldId, invalid, describedBy }) => (
            <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={line.itemId} onChange={update('itemId')} required>
              <option value="">Select an item</option>
              {items
                .filter((it) => it.status === 'active')
                .map((it) => (
                  <option key={it.id} value={it.id} data-added={it.id}>
                    {it.itemName}
                  </option>
                ))}
            </Select>
          )}
        </Field>

        <Field
          label="Counted quantity"
          required
          hint={currentQuantity != null ? `System currently shows ${currentQuantity.toLocaleString()}.` : undefined}
        >
          {({ id: fieldId, invalid, describedBy }) => (
            <Input
              id={fieldId}
              invalid={invalid}
              describedBy={describedBy}
              type="number"
              min={0}
              step="any"
              value={line.countedQuantity}
              onChange={update('countedQuantity')}
              required
            />
          )}
        </Field>
      </div>

      {canRemove && (
        <button type="button" className="mt-1 text-sm font-semibold text-danger-600 hover:underline" onClick={() => onRemove(index)}>
          Remove this item
        </button>
      )}
    </div>
  );
}

export default function StockAdjustmentFormPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [form, setForm] = useState({ siteId: '', adjustmentDate: todayDateOnly(), reason: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [items, setItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const itemIdsInStock = useItemIdsInStock(isAdmin ? form.siteId : String(user?.siteId ?? ''));
  const itemsInStock = useMemo(() => items.filter((it) => itemIdsInStock.has(it.id)), [items, itemIdsInStock]);

  useEffect(() => {
    listAll(itemsApi.list).then((r) => setItems(r.data)).catch(() => setItems([]));
    if (isAdmin) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, [isAdmin]);

  function updateForm(field) {
    return (event) => {
      setForm((f) => ({ ...f, [field]: event.target.value }));
      if (field === 'siteId') setLines([{ ...EMPTY_LINE }]);
    };
  }

  function updateLine(index, field, value) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
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

    // A blank must not count as 0: that would remove all of this item's stock at the site.
    const uncounted = lines.findIndex((line) => line.itemId !== '' && String(line.countedQuantity).trim() === '');
    if (uncounted >= 0) {
      setSubmitError(`Item ${uncounted + 1}: enter the counted quantity. Enter 0 only if none were counted.`);
      return;
    }

    setSubmitting(true);

    const payload = {
      siteId: isAdmin ? Number(form.siteId) : undefined,
      adjustmentDate: form.adjustmentDate,
      reason: form.reason || undefined,
      items: filledLines.map((line) => ({
        itemId: Number(line.itemId),
        countedQuantity: Number(line.countedQuantity),
      })),
    };

    try {
      const response = await stockAdjustmentsApi.create(payload);
      navigate(`/inventory/stock-adjustments/${response.data.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">New stock adjustment</h1>
        <p className="mt-1 text-steel-500">Enter what was physically counted — the system quantity is looked up automatically.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
            {isAdmin && (
              <Field label="Site" required>
                {({ id: fieldId, invalid, describedBy }) => (
                  <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={updateForm('siteId')} required>
                    <option value="">Select a site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id} data-added={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            <Field label="Adjustment date" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" value={form.adjustmentDate} onChange={updateForm('adjustmentDate')} required />
              )}
            </Field>

            <Field label="Reason">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.reason} onChange={updateForm('reason')} maxLength={2000} />
              )}
            </Field>
          </div>

          <div className="mt-4 border-t border-steel-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-steel-900">Items</h2>
              <Button type="button" variant="secondary" size="sm" onClick={addLine} disabled={isAdmin && !form.siteId}>
                Add item
              </Button>
            </div>

            {isAdmin && !form.siteId ? (
              <p className="text-sm text-steel-400">Select a site above to choose which items to count.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {lines.map((line, index) => (
                  <AdjustmentLine
                    key={index}
                    line={line}
                    index={index}
                    items={itemsInStock}
                    siteId={isAdmin ? form.siteId : ''}
                    onChange={updateLine}
                    onRemove={removeLine}
                    canRemove={lines.length > 1}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Record adjustment
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
