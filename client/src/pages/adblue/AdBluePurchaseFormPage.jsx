import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adblueApi, sitesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, todayDateOnly } from '../../config/fuel';

export default function AdBluePurchaseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [form, setForm] = useState({ siteId: '', supplierName: '', purchaseDate: todayDateOnly(), quantity: '', ratePerLitre: '' });
  const [sites, setSites] = useState([]);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin && !isEdit) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
    if (!isEdit) return;
    adblueApi
      .getPurchase(id)
      .then(({ data: r }) => {
        setForm({ siteId: String(r.siteId), supplierName: r.supplierName, purchaseDate: r.purchaseDate, quantity: String(r.quantity), ratePerLitre: String(r.ratePerLitre) });
        setLoaded(true);
      })
      .catch((err) => setLoadError(err.message));
  }, [id, isEdit, isAdmin]);

  function update(field) {
    return (event) => {
      const { value } = event.target;
      setForm((f) => ({ ...f, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    };
  }

  const quantity = Number(form.quantity);
  const rate = Number(form.ratePerLitre);
  const totalCost = quantity > 0 && rate > 0 ? Math.round(quantity * rate * 100) / 100 : null;

  function validate() {
    const found = {};
    if (isAdmin && !isEdit && !form.siteId) found.siteId = 'Choose the site storing this AdBlue.';
    if (!form.supplierName.trim()) found.supplierName = 'Enter the supplier name.';
    if (!form.purchaseDate) found.purchaseDate = 'Enter the purchase date.';
    else if (form.purchaseDate > todayDateOnly()) found.purchaseDate = 'The date cannot be in the future.';
    if (form.quantity === '') found.quantity = 'Enter the litres purchased.';
    else if (!(quantity > 0)) found.quantity = 'Litres must be greater than 0.';
    if (form.ratePerLitre === '') found.ratePerLitre = 'Enter the rate per litre.';
    else if (!(rate > 0)) found.ratePerLitre = 'Rate must be greater than 0.';
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = { supplierName: form.supplierName.trim(), purchaseDate: form.purchaseDate, quantity, ratePerLitre: rate };

    setSubmitting(true);
    try {
      if (isEdit) await adblueApi.updatePurchase(id, payload);
      else await adblueApi.createPurchase({ ...payload, siteId: isAdmin ? Number(form.siteId) : undefined });
      navigate('/adblue/purchases', { state: { message: isEdit ? 'AdBlue purchase updated.' : 'AdBlue purchase recorded. Stock has been added to the site.' } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const backLink = (
    <Link to="/adblue/purchases" className="text-sm font-semibold text-brand-600 hover:underline">
      ← AdBlue purchases
    </Link>
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tone="error">{loadError}</Alert>
        {backLink}
      </div>
    );
  }

  if (!loaded) return <Spinner label="Loading" />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        {backLink}
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{isEdit ? 'Edit AdBlue purchase' : 'Record AdBlue purchase'}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
            {isAdmin && !isEdit ? (
              <Field label="Site" required error={errors.siteId}>
                {({ id: fieldId, invalid, describedBy }) => (
                  <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={update('siteId')}>
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
              <Field label="Site" hint={isEdit ? "The site can't be changed after the purchase is saved." : undefined}>
                {({ id: fieldId, describedBy }) => <Input id={fieldId} describedBy={describedBy} value={siteNames[isEdit ? form.siteId : user?.siteId] ?? 'Your site'} disabled />}
              </Field>
            )}

            <Field label="Supplier name" required error={errors.supplierName}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.supplierName} onChange={update('supplierName')} maxLength={255} autoComplete="off" />
              )}
            </Field>

            <Field label="Purchase date" required error={errors.purchaseDate}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" max={todayDateOnly()} value={form.purchaseDate} onChange={update('purchaseDate')} />
              )}
            </Field>

            <Field label="Litres" required error={errors.quantity}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.quantity} onChange={update('quantity')} />
              )}
            </Field>

            <Field label="Rate per litre (₹)" required error={errors.ratePerLitre}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.ratePerLitre} onChange={update('ratePerLitre')} />
              )}
            </Field>

            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-steel-700">Total cost</p>
              <p className="text-lg font-semibold text-steel-900 tabular-nums">{formatCurrency(totalCost)}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Record purchase'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
