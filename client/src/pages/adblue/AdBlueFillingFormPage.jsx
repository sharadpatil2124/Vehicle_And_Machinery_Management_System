import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adblueApi, machineryApi, sitesApi, vehiclesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { assetDisplayName, formatCurrency, formatLitres, todayDateOnly } from '../../config/fuel';

export default function AdBlueFillingFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [form, setForm] = useState({ assetType: 'VEHICLE', assetId: '', siteId: '', fillingDate: todayDateOnly(), quantity: '' });
  const [existing, setExisting] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [machinery, setMachinery] = useState(null);
  const [sites, setSites] = useState([]);
  const [stock, setStock] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAll(vehiclesApi.list).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    listAll(machineryApi.list, { sort: 'rcpl:asc' }).then((r) => setMachinery(r.data)).catch(() => setMachinery([]));
    if (isAdmin && !isEdit) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
    if (!isEdit) return;
    adblueApi
      .getFilling(id)
      .then(({ data: r }) => {
        setExisting(r);
        setForm({ assetType: r.assetType, assetId: r.assetId, siteId: String(r.siteId), fillingDate: r.fillingDate, quantity: String(r.quantity) });
      })
      .catch((err) => setLoadError(err.message));
  }, [id, isEdit, isAdmin]);

  const assetOptions = useMemo(() => ((form.assetType === 'VEHICLE' ? vehicles : machinery) ?? []).filter((a) => a.status === 'active'), [vehicles, machinery, form.assetType]);
  const selectedAsset = assetOptions.find((a) => a.assetId === form.assetId) ?? null;
  const keepExistingOption = existing && existing.assetType === form.assetType && !assetOptions.some((a) => a.assetId === existing.assetId);

  const stockSiteId = isAdmin ? form.siteId : user?.siteId;

  useEffect(() => {
    setStock(null);
    if (!stockSiteId) return undefined;
    let cancelled = false;
    adblueApi
      .overview({ siteId: stockSiteId })
      .then((r) => {
        if (!cancelled) setStock(r.data.sites[0]?.remaining ? { quantity: r.data.sites[0].remaining.quantity, rate: r.data.sites[0].averageRate } : { quantity: 0, rate: 0 });
      })
      .catch(() => !cancelled && setStock(null));
    return () => {
      cancelled = true;
    };
  }, [stockSiteId]);

  const quantity = Number(form.quantity);
  const available = stock ? stock.quantity + (existing?.quantity ?? 0) : null;
  const rate = existing?.ratePerLitre ?? stock?.rate ?? null;
  const estimatedCost = quantity > 0 && rate != null ? Math.round(quantity * rate * 100) / 100 : null;
  const noStock = !isEdit && stock && stock.quantity <= 0;

  function update(field) {
    return (event) => {
      const { value } = event.target;
      setForm((f) => {
        if (field === 'assetType') return { ...f, assetType: value, assetId: '' };
        if (field === 'assetId' && isAdmin && !isEdit) {
          const asset = assetOptions.find((a) => a.assetId === value);
          return { ...f, assetId: value, siteId: asset?.currentSiteId ? String(asset.currentSiteId) : f.siteId };
        }
        return { ...f, [field]: value };
      });
      setErrors((e) => ({ ...e, [field]: undefined, ...(field === 'assetId' ? { siteId: undefined } : {}) }));
    };
  }

  function validate() {
    const found = {};
    if (!form.assetId) found.assetId = form.assetType === 'VEHICLE' ? 'Select a vehicle.' : 'Select a machine.';
    if (isAdmin && !isEdit && !form.siteId) found.siteId = 'Choose the site this AdBlue was taken from.';
    if (!form.fillingDate) found.fillingDate = 'Enter the filling date.';
    else if (form.fillingDate > todayDateOnly()) found.fillingDate = 'The date cannot be in the future.';
    if (form.quantity === '') found.quantity = 'Enter the litres filled.';
    else if (!(quantity > 0)) found.quantity = 'Litres must be greater than 0.';
    else if (available != null && quantity > available) found.quantity = `Only ${formatLitres(available)} available at this site.`;
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = { assetType: form.assetType, assetId: form.assetId, fillingDate: form.fillingDate, quantity };

    setSubmitting(true);
    try {
      if (isEdit) await adblueApi.updateFilling(id, payload);
      else await adblueApi.createFilling({ ...payload, siteId: isAdmin ? Number(form.siteId) : undefined });
      navigate('/adblue/fillings', { state: { message: isEdit ? 'AdBlue filling updated.' : 'AdBlue filling recorded.' } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const backLink = (
    <Link to="/adblue/fillings" className="text-sm font-semibold text-brand-600 hover:underline">
      ← AdBlue filling records
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

  if (vehicles === null || machinery === null || (isEdit && !existing)) return <Spinner label="Loading" />;

  const isVehicle = form.assetType === 'VEHICLE';
  const assetNumber = selectedAsset ? (isVehicle ? selectedAsset.registrationNumber : selectedAsset.rcpl) : keepExistingOption && form.assetId === existing.assetId ? existing.assetLabel : '';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        {backLink}
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{isEdit ? 'Edit AdBlue filling' : 'Record AdBlue filling'}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Filling date" required error={errors.fillingDate}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" max={todayDateOnly()} value={form.fillingDate} onChange={update('fillingDate')} />
              )}
            </Field>

            <Field label="Asset type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.assetType} onChange={update('assetType')}>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="MACHINERY">Machinery</option>
                </Select>
              )}
            </Field>

            <Field label={isVehicle ? 'Vehicle' : 'Machine'} required error={errors.assetId}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.assetId} onChange={update('assetId')}>
                  <option value="">{assetOptions.length ? 'Select an asset' : 'No active assets'}</option>
                  {keepExistingOption && (
                    <option value={existing.assetId}>
                      {existing.assetLabel ?? existing.assetId} ({existing.assetId})
                    </option>
                  )}
                  {assetOptions.map((a) => (
                    <option key={a.assetId} value={a.assetId} data-added={a.id}>
                      {assetDisplayName(form.assetType, a)} ({a.assetId})
                      {a.currentSiteId && siteNames[a.currentSiteId] ? ` — ${siteNames[a.currentSiteId]}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={isVehicle ? 'Registration number' : 'RCPL'}>{({ id: fieldId }) => <Input id={fieldId} value={assetNumber ?? ''} placeholder="Select an asset first" disabled />}</Field>

            {isAdmin && !isEdit ? (
              <Field label="Site" required error={errors.siteId} hint="Filled in from the selected asset. Stock is taken from this site.">
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
              <Field label="Site" hint={isEdit ? "The site can't be changed after the filling is saved." : undefined}>
                {({ id: fieldId, describedBy }) => <Input id={fieldId} describedBy={describedBy} value={siteNames[isEdit ? form.siteId : user?.siteId] ?? 'Your site'} disabled />}
              </Field>
            )}

            <Field label="Litres filled" required error={errors.quantity} hint={available != null ? `${formatLitres(available)} available at this site.` : undefined}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.quantity} onChange={update('quantity')} disabled={noStock} />
              )}
            </Field>
          </div>

          {noStock && (
            <Alert tone="warning">
              There's no AdBlue in stock at this site.{' '}
              <Link to="/adblue/purchases/new" className="font-semibold underline">
                Record a purchase
              </Link>{' '}
              first.
            </Alert>
          )}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-steel-700">Rate per litre</p>
              <p className="text-lg font-semibold text-steel-900 tabular-nums">{formatCurrency(rate)}</p>
              <p className="mt-0.5 text-xs text-steel-500">{isEdit ? 'Saved with this filling. Any extra litres are charged at the current stock rate.' : "Set automatically from the average cost of the site's remaining stock."}</p>
            </div>
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-steel-700">{isEdit ? 'Estimated total cost' : 'Total cost'}</p>
              <p className="text-lg font-semibold text-steel-900 tabular-nums">{formatCurrency(estimatedCost)}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={noStock}>
              {isEdit ? 'Save changes' : 'Record filling'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
