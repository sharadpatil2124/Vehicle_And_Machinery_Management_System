import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { machineryApi, sitesApi, tyresApi, vehiclesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { POSITION_SUGGESTIONS, formatCurrency, todayDateOnly } from '../../config/tyres';
import { machineryLabel } from '../../config/fuel';

function assetLabel(assetType, a) {
  if (assetType === 'VEHICLE') return `${a.registrationNumber} (${a.assetId}) · ${a.type}`;
  return `${machineryLabel(a)} (${a.assetId})`;
}

export default function TyreFitFormPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('');
  const [assets, setAssets] = useState({ VEHICLE: [], MACHINERY: [] });
  const [assetType, setAssetType] = useState('VEHICLE');
  const [assetId, setAssetId] = useState('');
  const [stock, setStock] = useState(null);
  const [form, setForm] = useState({ tyreTypeId: '', condition: 'new', count: '1', fittedAt: todayDateOnly(), meterReading: '' });
  const [tyres, setTyres] = useState([{ position: '', serialNumber: '' }]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAll(vehiclesApi.list, { sort: 'registrationNumber:asc' }).then((r) => setAssets((a) => ({ ...a, VEHICLE: r.data }))).catch(() => {});
    listAll(machineryApi.list, { sort: 'rcpl:asc' }).then((r) => setAssets((a) => ({ ...a, MACHINERY: r.data }))).catch(() => {});
    if (isAdmin) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, [isAdmin]);

  const effectiveSiteId = isAdmin ? siteId : user?.siteId ? String(user.siteId) : '';
  const siteAssets = effectiveSiteId ? assets[assetType].filter((a) => String(a.currentSiteId) === effectiveSiteId) : [];
  const asset = siteAssets.find((a) => a.assetId === assetId) ?? null;
  const assetNoun = assetType === 'VEHICLE' ? 'vehicle' : 'machine';
  const readingIsHours = assetType === 'MACHINERY' || Boolean(asset?.isHoursBased);
  const readingLabel = readingIsHours ? 'Current Hours' : 'Current KM';

  useEffect(() => {
    setStock(null);
    setForm((f) => ({ ...f, tyreTypeId: '', condition: 'new', meterReading: '' }));
    if (!asset?.currentSiteId) return;
    tyresApi
      .stock({ siteId: asset.currentSiteId })
      .then((r) => setStock(r.data.rows.filter((row) => row.siteId === asset.currentSiteId && (row.newQuantity > 0 || row.usedQuantity > 0))))
      .catch((err) => setError(err.message));
  }, [asset?.assetId, asset?.currentSiteId]);

  const selectedStock = useMemo(() => stock?.find((row) => String(row.tyreTypeId) === form.tyreTypeId) ?? null, [stock, form.tyreTypeId]);
  const available = selectedStock ? (form.condition === 'used' ? selectedStock.usedQuantity : selectedStock.newQuantity) : 0;

  const clearError = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

  function setCount(value) {
    clearError('count');
    setForm((f) => ({ ...f, count: value }));
    const n = Math.min(50, Math.max(0, Math.floor(Number(value)) || 0));
    setTyres((current) => Array.from({ length: n }, (_, i) => current[i] ?? { position: '', serialNumber: '' }));
  }

  function updateTyre(index, field, value) {
    setTyres((all) => all.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
    setErrors((e) => ({ ...e, [`position${index}`]: undefined }));
  }

  function quickPick(position) {
    const index = tyres.findIndex((t) => !t.position.trim());
    if (index >= 0) updateTyre(index, 'position', position);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const count = Number(form.count);
    const readingValue = Number(form.meterReading);
    const next = {
      siteId: effectiveSiteId ? null : isAdmin ? 'Choose a site.' : 'No site is assigned to your account. Ask your Admin to assign one.',
      asset: !effectiveSiteId ? null : asset ? null : `Choose a ${assetNoun}.`,
      tyreTypeId: form.tyreTypeId ? null : 'Choose a tyre type.',
      count: !Number.isInteger(count) || count < 1 ? 'Enter how many tyres, 1 or more.' : count > available ? `Only ${available} available at this site.` : null,
      fittedAt: !form.fittedAt ? 'Choose the fitting date.' : form.fittedAt > todayDateOnly() ? "Date can't be in the future." : null,
      meterReading:
        form.meterReading === '' || !Number.isFinite(readingValue)
          ? `Enter the ${readingLabel}.`
          : readingValue < 0
            ? `${readingLabel} must be 0 or more.`
            : null,
    };
    tyres.forEach((t, i) => {
      if (!t.position.trim()) next[`position${i}`] = 'Enter a position.';
    });
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await tyresApi.fit({
        siteId: Number(effectiveSiteId),
        assetType,
        assetId,
        tyreTypeId: Number(form.tyreTypeId),
        tyreCondition: form.condition,
        fittedAt: form.fittedAt,
        meterReading: readingValue,
        tyres: tyres.map((t) => ({ position: t.position.trim(), serialNumber: t.serialNumber.trim() || null })),
      });
      const label = assetType === 'VEHICLE' ? asset.registrationNumber : machineryLabel(asset);
      navigate('/tyres/fitting', { state: { message: `${response.data.length} ${response.data.length === 1 ? 'tyre' : 'tyres'} fitted to ${label}.` } });
    } catch (err) {
      if (/can't be lower than/.test(err.message)) setErrors((e) => ({ ...e, meterReading: err.message }));
      else if (/^Fitting date/.test(err.message)) setErrors((e) => ({ ...e, fittedAt: err.message }));
      else setError(err.message);
      setSubmitting(false);
    }
  }

  const costPreview = selectedStock && form.condition === 'new' ? selectedStock.averageCost * (Number(form.count) || 0) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <Link to="/tyres/fitting" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Tyre fitting
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">Fit tyres</h1>
        <p className="mt-1 text-steel-500">Tyres are taken from the stock of the asset's site.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{error}</Alert>

        <Card>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {isAdmin ? (
              <Field label="Site" required error={errors.siteId}>
                {({ id, invalid, describedBy }) => (
                  <Select
                    id={id}
                    invalid={invalid}
                    describedBy={describedBy}
                    value={siteId}
                    onChange={(e) => {
                      clearError('siteId');
                      clearError('asset');
                      setSiteId(e.target.value);
                      setAssetId('');
                    }}
                  >
                    <option value="">Choose a site…</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id} data-added={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Site" error={errors.siteId}>
                {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={effectiveSiteId ? siteNames[effectiveSiteId] ?? 'Your site' : 'Not assigned'} disabled />}
              </Field>
            )}
            <fieldset className="mb-3">
              <legend className="mb-1.5 text-sm font-semibold text-steel-700">
                Asset type <span className="text-danger-600">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['VEHICLE', 'Vehicle'],
                  ['MACHINERY', 'Machinery'],
                ].map(([value, label]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${assetType === value ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-steel-200'}`}>
                    <input
                      type="radio"
                      name="assetType"
                      value={value}
                      checked={assetType === value}
                      onChange={() => {
                        setAssetType(value);
                        setAssetId('');
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Field label={assetType === 'VEHICLE' ? 'Vehicle' : 'Machine'} required error={errors.asset}>
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={assetId} disabled={!effectiveSiteId} onChange={(e) => {
                      clearError('asset');
                      setAssetId(e.target.value);
                    }}>
                    <option value="">
                      {!effectiveSiteId ? 'Choose the site first' : siteAssets.length ? `Choose a ${assetNoun}…` : `No ${assetType === 'VEHICLE' ? 'vehicles' : 'machinery'} at this site`}
                    </option>
                    {siteAssets.map((a) => (
                      <option key={a.id} value={a.assetId} data-added={a.id}>
                        {assetLabel(assetType, a)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>

          <div className="grid gap-x-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field
                label="Tyre type"
                required
                error={errors.tyreTypeId}
                hint={asset && stock && stock.length === 0 ? "No tyres in stock at this asset's site. Record a purchase first." : undefined}
              >
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={form.tyreTypeId} onChange={(e) => {
                      clearError('tyreTypeId');
                      clearError('count');
                      setForm((f) => ({ ...f, tyreTypeId: e.target.value, condition: 'new' }));
                    }} disabled={!stock || stock.length === 0}>
                    <option value="">{asset ? 'Choose a tyre type…' : 'Choose the asset first'}</option>
                    {(stock ?? []).map((row) => (
                      <option key={row.tyreTypeId} value={row.tyreTypeId} data-added={row.tyreTypeId}>
                        {row.tyreTypeLabel} · {row.tyreSize} — {row.newQuantity} in stock{row.usedQuantity ? `, ${row.usedQuantity} returned` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Number of tyres" required error={errors.count} hint={selectedStock ? `Up to ${available} available` : undefined}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} type="number" min="1" max="50" step="1" inputMode="numeric" invalid={invalid} describedBy={describedBy} value={form.count} onChange={(e) => setCount(e.target.value)} />
              )}
            </Field>
          </div>

          {selectedStock?.usedQuantity > 0 && (
            <fieldset className="mb-3">
              <legend className="mb-1.5 text-sm font-semibold text-steel-700">New or returned tyres?</legend>
              <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
                {[
                  ['new', 'New tyres', `${selectedStock.newQuantity} in stock · ${formatCurrency(selectedStock.averageCost)} each`],
                  ['used', 'Returned (used)', `${selectedStock.usedQuantity} available · no further cost`],
                ].map(([value, title, text]) => (
                  <label key={value} className={`flex cursor-pointer gap-2 rounded border px-3 py-2 text-sm ${form.condition === value ? 'border-brand-600 bg-brand-50' : 'border-steel-200'}`}>
                    <input type="radio" name="condition" value={value} checked={form.condition === value} onChange={() => setForm((f) => ({ ...f, condition: value }))} className="mt-0.5" />
                    <span>
                      <span className="block font-semibold text-steel-900">{title}</span>
                      <span className="text-steel-500">{text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Fitting date" required error={errors.fittedAt}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} type="date" invalid={invalid} describedBy={describedBy} value={form.fittedAt} max={todayDateOnly()} onChange={(e) => {
                    clearError('fittedAt');
                    setForm((f) => ({ ...f, fittedAt: e.target.value }));
                  }} />
              )}
            </Field>
            <Field
              label={readingLabel}
              required
              error={errors.meterReading}
              hint={`Type the ${readingIsHours ? 'hour meter' : 'odometer'} reading at the time of fitting.`}
            >
              {({ id, invalid, describedBy }) => (
                <Input id={id} type="number" min="0" step="any" inputMode="decimal" placeholder={readingIsHours ? 'e.g. 1480' : 'e.g. 42500'} invalid={invalid} describedBy={describedBy} value={form.meterReading} onChange={(e) => {
                    clearError('meterReading');
                    setForm((f) => ({ ...f, meterReading: e.target.value }));
                  }} />
              )}
            </Field>
          </div>
        </Card>

        <Card title={`Tyre positions (${tyres.length})`} className="mt-4">
          {tyres.length === 0 ? (
            <p className="text-sm text-steel-500">Enter how many tyres you are fitting.</p>
          ) : (
            <>
              <div className="grid gap-3">
                {tyres.map((t, i) => (
                  <div key={i} className="grid items-start gap-3 sm:grid-cols-[2rem_1fr_1fr]">
                    <span className="pt-2 text-sm font-semibold text-steel-500">{i + 1}</span>
                    <div>
                      <Input aria-label={`Tyre ${i + 1} position`} placeholder="Position, e.g. Front left" value={t.position} maxLength={50} invalid={Boolean(errors[`position${i}`])} onChange={(e) => updateTyre(i, 'position', e.target.value)} />
                      {errors[`position${i}`] && <p className="mt-1 text-xs font-medium text-danger-600">{errors[`position${i}`]}</p>}
                    </div>
                    <Input aria-label={`Tyre ${i + 1} serial number`} placeholder="Serial number (optional)" value={t.serialNumber} maxLength={64} onChange={(e) => updateTyre(i, 'serialNumber', e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-steel-500">
                Quick picks:
                {POSITION_SUGGESTIONS.map((p) => (
                  <button key={p} type="button" className="rounded-full border border-dashed border-steel-300 px-2.5 py-0.5 text-steel-600 hover:border-brand-600 hover:text-brand-700" onClick={() => quickPick(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-steel-600">
            {selectedStock && asset ? (
              form.condition === 'used' ? (
                'Returned tyres are fitted at no further cost.'
              ) : (
                <>
                  Cost charged to this asset: about <span className="font-semibold text-steel-900">{formatCurrency(costPreview)}</span>
                </>
              )
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button as={Link} to="/tyres/fitting" variant="secondary">
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Fit {tyres.length || ''} {tyres.length === 1 ? 'tyre' : 'tyres'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
