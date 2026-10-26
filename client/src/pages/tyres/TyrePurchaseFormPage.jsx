import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sitesApi, tyresApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import TyreTypeModal from '../../components/tyres/TyreTypeModal';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, todayDateOnly, tyreTypeName } from '../../config/tyres';

const NEW_TYPE = '__new__';

let nextKey = 1;
const blankLine = () => ({ key: nextKey++, tyreTypeId: '', quantity: '', unitPrice: '', taxPercentage: '0' });

function lineFigures(line) {
  const quantity = Number(line.quantity);
  const price = Number(line.unitPrice);
  const tax = line.taxPercentage === '' ? 0 : Number(line.taxPercentage);
  if (!(quantity > 0) || !(price > 0) || !Number.isFinite(tax)) return null;
  const unitCost = Math.round(price * (1 + tax / 100) * 100) / 100;
  return { quantity, beforeTax: price * quantity, unitCost, total: Math.round(unitCost * quantity * 100) / 100 };
}

export default function TyrePurchaseFormPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [sites, setSites] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ siteId: '', supplierName: '', purchaseDate: todayDateOnly(), billNumber: '', notes: '' });
  const [lines, setLines] = useState([blankLine()]);
  const [errors, setErrors] = useState({});
  const [lineErrors, setLineErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newTypeFor, setNewTypeFor] = useState(null);

  useEffect(() => {
    if (isAdmin) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
    listAll(tyresApi.types).then((r) => setTypes(r.data)).catch(() => setTypes([]));
  }, [isAdmin]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function updateLine(key, field, value) {
    if (field === 'tyreTypeId' && value === NEW_TYPE) {
      setNewTypeFor(key);
      return;
    }
    setLines((all) => all.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
    setLineErrors((all) => ({ ...all, [key]: { ...all[key], [field]: undefined } }));
  }

  const figures = lines.map(lineFigures);
  const totals = figures.reduce(
    (t, f) => (f ? { tyres: t.tyres + f.quantity, beforeTax: t.beforeTax + f.beforeTax, total: t.total + f.total } : t),
    { tyres: 0, beforeTax: 0, total: 0 }
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {
      siteId: isAdmin && !form.siteId ? 'Choose the site receiving these tyres.' : null,
      purchaseDate: !form.purchaseDate ? 'Choose the purchase date.' : form.purchaseDate > todayDateOnly() ? "Purchase date can't be in the future." : null,
    };
    const nextLines = {};
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const tax = line.taxPercentage === '' ? 0 : Number(line.taxPercentage);
      const e = {
        tyreTypeId: line.tyreTypeId ? null : 'Choose a tyre type.',
        quantity: Number.isInteger(quantity) && quantity >= 1 ? null : 'Enter a whole number, 1 or more.',
        unitPrice: Number(line.unitPrice) > 0 ? null : 'Enter a price more than 0.',
        taxPercentage: Number.isFinite(tax) && tax >= 0 && tax <= 100 ? null : 'GST must be 0 to 100.',
      };
      if (Object.values(e).some(Boolean)) nextLines[line.key] = e;
    }
    setErrors(next);
    setLineErrors(nextLines);
    if (Object.values(next).some(Boolean) || Object.keys(nextLines).length) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await tyresApi.createPurchase({
        siteId: isAdmin ? Number(form.siteId) : undefined,
        supplierName: form.supplierName.trim() || null,
        purchaseDate: form.purchaseDate,
        billNumber: form.billNumber || null,
        notes: form.notes || null,
        items: lines.map((l) => ({
          tyreTypeId: Number(l.tyreTypeId),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxPercentage: l.taxPercentage === '' ? 0 : Number(l.taxPercentage),
        })),
      });
      navigate(`/tyres/purchases/${response.data.id}`, {
        state: { message: `${response.data.purchaseNumber} saved — ${response.data.tyreCount} tyres added to stock.` },
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const cellInput = 'w-full rounded border px-2 py-1.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none';
  const border = (bad) => (bad ? 'border-danger-500' : 'border-steel-200');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3">
        <Link to="/tyres/purchases" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Tyre purchases
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">New tyre purchase</h1>
        <p className="mt-1 text-steel-500">One supplier bill, many tyres. Tyres are added to the site's stock when you save.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{error}</Alert>

        <Card>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin ? (
              <Field label="Site" required error={errors.siteId}>
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={update('siteId')}>
                    <option value="">Choose a site…</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id} data-added={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Site">{({ id }) => <Input id={id} value={siteNames[user?.siteId] ?? 'Your site'} disabled />}</Field>
            )}
            <Field label="Supplier" hint="Type the supplier's name.">
              {({ id, describedBy }) => (
                <Input id={id} describedBy={describedBy} value={form.supplierName} onChange={update('supplierName')} maxLength={255} placeholder="e.g. Patil Tyres, Pune" autoComplete="off" />
              )}
            </Field>
            <Field label="Purchase date" required error={errors.purchaseDate}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} type="date" invalid={invalid} describedBy={describedBy} value={form.purchaseDate} max={todayDateOnly()} onChange={update('purchaseDate')} />
              )}
            </Field>
            <Field label="Bill / invoice no.">{({ id }) => <Input id={id} value={form.billNumber} onChange={update('billNumber')} maxLength={64} />}</Field>
          </div>
        </Card>

        <Card
          title="Tyres"
          className="mt-4"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setLines((all) => [...all, blankLine()])}>
              + Add line
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-steel-200 text-xs font-semibold tracking-wide text-steel-500 uppercase">
                  <th className="py-2 pr-3">Tyre type</th>
                  <th className="w-24 py-2 pr-3 text-right">Quantity</th>
                  <th className="w-36 py-2 pr-3 text-right">Price / tyre (before GST)</th>
                  <th className="w-20 py-2 pr-3 text-right">GST %</th>
                  <th className="w-32 py-2 pr-3 text-right">Price / tyre (incl. GST)</th>
                  <th className="w-32 py-2 text-right">Line total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const e = lineErrors[line.key] ?? {};
                  const f = figures[index];
                  return (
                    <tr key={line.key} className="border-b border-steel-100 align-top">
                      <td className="py-2 pr-3">
                        <Select
                          aria-label={`Line ${index + 1} tyre type`}
                          invalid={Boolean(e.tyreTypeId)}
                          value={line.tyreTypeId}
                          onChange={(ev) => updateLine(line.key, 'tyreTypeId', ev.target.value)}
                        >
                          <option value="">Choose a tyre type…</option>
                          {types.map((t) => (
                            <option key={t.id} value={t.id} data-added={t.id}>
                              {tyreTypeName(t)}
                            </option>
                          ))}
                          <option value={NEW_TYPE}>+ New tyre type…</option>
                        </Select>
                        {e.tyreTypeId && <p className="mt-1 text-xs text-danger-600">{e.tyreTypeId}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <input aria-label={`Line ${index + 1} quantity`} type="number" min="1" step="1" inputMode="numeric" className={`${cellInput} ${border(e.quantity)} text-right`} value={line.quantity} onChange={(ev) => updateLine(line.key, 'quantity', ev.target.value)} />
                        {e.quantity && <p className="mt-1 text-xs text-danger-600">{e.quantity}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <input aria-label={`Line ${index + 1} price per tyre`} type="number" min="0" step="0.01" inputMode="decimal" className={`${cellInput} ${border(e.unitPrice)} text-right`} value={line.unitPrice} onChange={(ev) => updateLine(line.key, 'unitPrice', ev.target.value)} />
                        {e.unitPrice && <p className="mt-1 text-xs text-danger-600">{e.unitPrice}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <input aria-label={`Line ${index + 1} GST percent`} type="number" min="0" max="100" step="0.01" inputMode="decimal" className={`${cellInput} ${border(e.taxPercentage)} text-right`} value={line.taxPercentage} onChange={(ev) => updateLine(line.key, 'taxPercentage', ev.target.value)} />
                        {e.taxPercentage && <p className="mt-1 text-xs text-danger-600">{e.taxPercentage}</p>}
                      </td>
                      <td className="py-3.5 pr-3 text-right tabular-nums text-steel-700">{f ? formatCurrency(f.unitCost) : '—'}</td>
                      <td className="py-3.5 text-right font-semibold tabular-nums text-steel-900">{f ? formatCurrency(f.total) : '—'}</td>
                      <td className="py-3 pl-2 text-right">
                        {lines.length > 1 && (
                          <button type="button" aria-label={`Remove line ${index + 1}`} className="text-steel-500 hover:text-danger-600" onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-xs text-sm">
              <div className="flex justify-between py-1">
                <dt className="text-steel-600">{totals.tyres} tyres · before GST</dt>
                <dd className="tabular-nums">{formatCurrency(totals.beforeTax)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-steel-600">GST</dt>
                <dd className="tabular-nums">{formatCurrency(Math.round((totals.total - totals.beforeTax) * 100) / 100)}</dd>
              </div>
              <div className="flex justify-between border-t border-steel-200 pt-2 font-semibold text-steel-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card className="mt-4">
          <Field label="Notes">
            {({ id }) => (
              <textarea
                id={id}
                rows={2}
                maxLength={1000}
                value={form.notes}
                onChange={update('notes')}
                className="w-full rounded border border-steel-200 px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
              />
            )}
          </Field>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button as={Link} to="/tyres/purchases" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save purchase
          </Button>
        </div>
      </form>

      <TyreTypeModal
        open={newTypeFor !== null}
        onClose={() => setNewTypeFor(null)}
        onSaved={(type) => {
          setTypes((all) => [...all, type].sort((a, b) => tyreTypeName(a).localeCompare(tyreTypeName(b))));
          setLines((all) => all.map((l) => (l.key === newTypeFor ? { ...l, tyreTypeId: String(type.id) } : l)));
          setLineErrors((all) => ({ ...all, [newTypeFor]: { ...all[newTypeFor], tyreTypeId: undefined } }));
          setNewTypeFor(null);
        }}
      />
    </div>
  );
}
