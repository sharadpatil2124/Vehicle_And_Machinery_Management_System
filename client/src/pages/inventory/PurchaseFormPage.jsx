import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { purchasesApi, suppliersApi, itemsApi, sitesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { todayDateOnly } from '../../config/fuel';

const EMPTY_LINE = {
  itemId: '',
  purchasedQuantity: '',
  unitPrice: '',
  taxPercentage: '0',
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
    purchasedQuantity: line.purchasedQuantity,
    unitPrice: line.unitPrice,
    taxPercentage: line.taxPercentage,
  }));
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function lineFigures(line) {
  const quantity = Number(line.purchasedQuantity);
  const price = Number(line.unitPrice);
  const tax = line.taxPercentage === '' ? 0 : Number(line.taxPercentage);
  if (!(quantity > 0) || line.unitPrice === '' || !(price >= 0) || !(tax >= 0)) return null;

  const subtotal = quantity * price;
  const taxAmount = Math.round(subtotal * (tax / 100) * 100) / 100;
  const lineTotal = Math.round((subtotal + taxAmount) * 100) / 100;
  const priceInclTax = price * (1 + tax / 100);
  return { lineTotal, priceInclTax };
}

const LINE_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-[1.75rem_minmax(0,3fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_2rem] lg:items-center lg:gap-y-0';

const cellLabel = 'mb-1 block text-xs font-semibold text-steel-600 lg:sr-only';

function CellLabel({ htmlFor, required = false, children }) {
  return (
    <label htmlFor={htmlFor} className={cellLabel}>
      {children}
      {required && <span className="ml-0.5 text-danger-600">*</span>}
    </label>
  );
}

export default function PurchaseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [form, setForm] = useState({ siteId: '', supplierId: '', purchaseDate: todayDateOnly(), remarks: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [notEditable, setNotEditable] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    Promise.all([listAll(suppliersApi.list), isEdit ? listAll(suppliersApi.list, { status: 'archived' }) : { data: [] }])
      .then(([active, archived]) => setSuppliers([...active.data, ...archived.data]))
      .catch(() => setSuppliers([]));
    listAll(itemsApi.list)
      .then((response) => setItems(response.data))
      .catch(() => setItems([]));
    if (isAdmin) {
      listAll(sitesApi.list)
        .then((response) => setSites(response.data))
        .catch(() => setSites([]));
    }
  }, [isAdmin, isEdit]);

  const purchaseTotal = useMemo(() => {
    const priced = lines.map(lineFigures).filter(Boolean);
    if (priced.length === 0) return null;
    return { count: priced.length, total: Math.round(priced.reduce((t, f) => t + f.lineTotal, 0) * 100) / 100 };
  }, [lines]);

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

    // A blank must not count as ₹0: the stock would be valued at nothing.
    const unpriced = lines.findIndex((line) => line.itemId !== '' && String(line.unitPrice).trim() === '');
    if (unpriced >= 0) {
      setSubmitError(`Item ${unpriced + 1}: enter the unit price. Enter 0 only if it was free.`);
      return;
    }

    setSubmitting(true);

    const itemsPayload = filledLines.map((line) => ({
      itemId: Number(line.itemId),
      purchasedQuantity: Number(line.purchasedQuantity),
      unitPrice: Number(line.unitPrice),
      taxPercentage: line.taxPercentage === '' ? 0 : Number(line.taxPercentage),
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
    <div className="mx-auto max-w-6xl">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">{isEdit ? 'Edit purchase' : 'New purchase'}</h1>
        <p className="mt-1 text-steel-500">
          {isEdit ? 'Nothing here has been received yet.' : 'Nothing moves into stock until this is received.'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
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
                      <option key={site.id} value={site.id} data-added={site.id}>
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
                    .filter((s) => s.status === 'active' || String(s.id) === String(form.supplierId))
                    .map((s) => (
                      <option key={s.id} value={s.id} data-added={s.id}>
                        {s.status === 'archived' ? `${s.supplierName} (archived)` : s.supplierName}
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

          <div className="mt-4 border-t border-steel-200 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-steel-900">Items</h2>

            <div
              aria-hidden="true"
              className={`${LINE_GRID} hidden border-b border-steel-200 pb-2 text-xs font-semibold tracking-wide text-steel-500 uppercase lg:grid`}
            >
              <span>#</span>
              <span>
                Item<span className="ml-0.5 text-danger-600">*</span>
              </span>
              <span className="text-right">
                Quantity<span className="ml-0.5 text-danger-600">*</span>
              </span>
              <span className="text-right">
                Unit price<span className="ml-0.5 text-danger-600">*</span>
              </span>
              <span className="text-right">Tax %</span>
              <span className="text-right">Total incl. tax</span>
              <span />
            </div>

            <div className="flex flex-col gap-2 lg:gap-0">
              {lines.map((line, index) => {
                const figures = lineFigures(line);
                const rowId = `purchase-line-${index}`;
                return (
                  <div
                    key={index}
                    className={`${LINE_GRID} rounded border border-steel-200 p-3 lg:rounded-none lg:border-0 lg:border-b lg:border-steel-100 lg:px-0 lg:py-1.5`}
                  >
                    <div className="col-span-2 flex items-center justify-between sm:col-span-4 lg:col-span-1">
                      <span className="text-sm font-semibold text-steel-500 tabular-nums">
                        <span className="lg:hidden">Item </span>
                        {index + 1}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-danger-600 hover:underline lg:hidden"
                          onClick={() => removeLine(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <CellLabel htmlFor={`${rowId}-item`} required>
                        Item
                      </CellLabel>
                      <Select id={`${rowId}-item`} aria-label={`Item ${index + 1}`} value={line.itemId} onChange={updateLine(index, 'itemId')} required showAllOnScroll>
                        <option value="">Select an item</option>
                        {items
                          .filter((it) => it.status === 'active')
                          .map((it) => (
                            <option key={it.id} value={it.id} data-added={it.id}>
                              {it.itemName}
                            </option>
                          ))}
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <CellLabel htmlFor={`${rowId}-quantity`} required>
                        Quantity
                      </CellLabel>
                      <Input
                        id={`${rowId}-quantity`}
                        aria-label={`Quantity for item ${index + 1}`}
                        className="text-right tabular-nums"
                        type="number"
                        min={0.001}
                        step="any"
                        inputMode="decimal"
                        value={line.purchasedQuantity}
                        onChange={updateLine(index, 'purchasedQuantity')}
                        required
                      />
                    </div>

                    <div className="min-w-0">
                      <CellLabel htmlFor={`${rowId}-price`} required>
                        Unit price (before tax)
                      </CellLabel>
                      <Input
                        id={`${rowId}-price`}
                        aria-label={`Unit price before tax for item ${index + 1}`}
                        className="text-right tabular-nums"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={updateLine(index, 'unitPrice')}
                        required
                      />
                    </div>

                    <div className="min-w-0">
                      <CellLabel htmlFor={`${rowId}-tax`}>Tax %</CellLabel>
                      <Input
                        id={`${rowId}-tax`}
                        aria-label={`Tax percent for item ${index + 1}`}
                        className="text-right tabular-nums"
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={line.taxPercentage}
                        onChange={updateLine(index, 'taxPercentage')}
                      />
                    </div>

                    <div className="min-w-0 sm:text-right">
                      <span className={cellLabel}>Total incl. tax</span>
                      <div className="text-sm font-semibold text-steel-900 tabular-nums">{figures ? currency.format(figures.lineTotal) : '—'}</div>
                      {figures && (
                        <div className="text-xs text-steel-500 tabular-nums">{currency.format(figures.priceInclTax)} / unit</div>
                      )}
                    </div>

                    <div className="hidden text-right lg:block">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove item ${index + 1}`}
                          title="Remove this item"
                          className="rounded px-1.5 py-0.5 text-steel-500 hover:bg-danger-50 hover:text-danger-600"
                          onClick={() => removeLine(index)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                + Add another item
              </Button>
              {purchaseTotal && (
                <p className="text-sm text-steel-600">
                  {purchaseTotal.count} {purchaseTotal.count === 1 ? 'item' : 'items'} · Total incl. tax{' '}
                  <span className="font-semibold text-steel-900 tabular-nums">{currency.format(purchaseTotal.total)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
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
