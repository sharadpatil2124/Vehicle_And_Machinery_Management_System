import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fuelTransactionsApi, fuelStationsApi, machineryApi, siteFuelStockApi, vehiclesApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import useSiteNames from '../../hooks/useSiteNames';
import {
  SOURCE_LABEL,
  STORABLE_FUEL_TYPES,
  assetDisplayName,
  formatCurrency,
  formatLitres,
  formatNumber,
  meterTypeForAsset,
  meterUnitLabel,
  todayDateOnly,
} from '../../config/fuel';

function currentMeter(assetType, asset) {
  if (!asset) return null;
  return meterTypeForAsset(assetType, asset) === 'HOURS' ? asset.currentHours : asset.currentKM;
}

function SourceOption({ value, current, title, description, onSelect, disabled }) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'flex-1 rounded border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-steel-200 bg-white hover:border-steel-300',
      ].join(' ')}
    >
      <span className="block text-sm font-semibold text-steel-900">{title}</span>
      <span className="mt-0.5 block text-xs text-steel-500">{description}</span>
    </button>
  );
}

export default function FuelIssueFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteNames = useSiteNames();

  const [form, setForm] = useState({
    source: 'SITE_STOCK',
    assetType: searchParams.get('assetType') === 'MACHINERY' ? 'MACHINERY' : 'VEHICLE',
    assetId: searchParams.get('assetId') ?? '',
    txnDate: todayDateOnly(),
    quantity: '',
    pricePerLitre: '',
    fuelStationId: '',
    meterReading: '',
    notes: '',
  });
  const [existing, setExisting] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [machinery, setMachinery] = useState(null);
  const [stations, setStations] = useState([]);
  const [stock, setStock] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fuelStationsApi.list({ limit: 100 }).then((r) => setStations(r.data)).catch(() => setStations([]));
    if (isEdit) {
      fuelTransactionsApi
        .get(id)
        .then((response) => {
          const r = response.data;
          setExisting(r);
          setForm({
            source: r.source,
            assetType: r.assetType,
            assetId: r.assetId,
            txnDate: r.txnDate,
            quantity: String(r.quantity),
            pricePerLitre: r.source === 'DIRECT_PUMP' ? String(r.pricePerLitre) : '',
            fuelStationId: r.fuelStationId ? String(r.fuelStationId) : '',
            meterReading: String(r.meterReading),
            notes: r.notes ?? '',
          });
        })
        .catch((err) => setLoadError(err.message));
      return;
    }
    vehiclesApi.list({ limit: 100 }).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    machineryApi.list({ limit: 100 }).then((r) => setMachinery(r.data)).catch(() => setMachinery([]));
  }, [id, isEdit]);

  const assetOptions = useMemo(() => {
    const source = form.assetType === 'VEHICLE' ? vehicles : machinery;
    return (source ?? []).filter((a) => a.status === 'active' && (form.source === 'DIRECT_PUMP' || a.currentSiteId));
  }, [vehicles, machinery, form.assetType, form.source]);

  const selectedAsset = useMemo(() => assetOptions.find((a) => a.assetId === form.assetId) ?? null, [assetOptions, form.assetId]);

  const fuelType = isEdit ? existing?.fuelType : selectedAsset?.fuelType;
  const storable = STORABLE_FUEL_TYPES.includes(fuelType);
  const siteId = isEdit ? existing?.siteId : selectedAsset?.currentSiteId;

  useEffect(() => {
    if (isEdit || form.source !== 'SITE_STOCK' || !siteId || !storable) {
      setStock(null);
      return;
    }
    let cancelled = false;
    siteFuelStockApi
      .list({ siteId, fuelType })
      .then((r) => {
        if (cancelled) return;
        const row = r.data.find((x) => x.siteId === siteId && x.fuelType === fuelType);
        setStock(row ?? { quantityOnHand: 0, averageCost: 0, inTransitQuantity: 0 });
      })
      .catch(() => !cancelled && setStock(null));
    return () => {
      cancelled = true;
    };
  }, [isEdit, form.source, siteId, fuelType, storable]);

  const meterType = isEdit ? existing?.meterType : selectedAsset ? meterTypeForAsset(form.assetType, selectedAsset) : null;
  const unit = meterType ? meterUnitLabel(meterType) : null;
  const meterLabel = meterType === 'HOURS' ? 'Hour meter reading' : meterType === 'KM' ? 'Odometer reading (KM)' : 'Meter reading';
  const reading = currentMeter(form.assetType, selectedAsset);
  const quantity = Number(form.quantity);

  const estimatedCost =
    form.source === 'SITE_STOCK'
      ? stock && quantity > 0
        ? Math.round(quantity * stock.averageCost * 100) / 100
        : isEdit
          ? existing?.amount
          : null
      : quantity > 0 && Number(form.pricePerLitre) > 0
        ? Math.round(quantity * Number(form.pricePerLitre) * 100) / 100
        : null;

  const siteStockBlocked = !isEdit && form.source === 'SITE_STOCK' && selectedAsset && !storable;

  function update(field) {
    return (event) => {
      const value = event.target.value;
      setForm((f) => (field === 'assetType' ? { ...f, assetType: value, assetId: '' } : { ...f, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    };
  }

  function chooseSource(source) {
    setForm((f) => ({ ...f, source }));
    setErrors({});
  }

  function validate() {
    const found = {};
    if (!isEdit && !form.assetId) found.assetId = 'Select an asset.';
    if (!form.txnDate) found.txnDate = 'Enter the date.';
    else if (form.txnDate > todayDateOnly()) found.txnDate = 'The date cannot be in the future.';
    if (form.quantity === '') found.quantity = 'Enter the litres.';
    else if (!(quantity > 0)) found.quantity = 'Litres must be greater than 0.';
    else if (!isEdit && form.source === 'SITE_STOCK' && stock && quantity > stock.quantityOnHand) {
      found.quantity = `Only ${formatLitres(stock.quantityOnHand)} in this site's stock.`;
    }
    if (form.source === 'DIRECT_PUMP') {
      if (form.pricePerLitre === '') found.pricePerLitre = 'Enter the price per litre.';
      else if (!(Number(form.pricePerLitre) > 0)) found.pricePerLitre = 'Price must be greater than 0.';
    }
    if (form.meterReading === '') found.meterReading = 'Enter the meter reading at fill-up.';
    else if (!(Number(form.meterReading) >= 0)) found.meterReading = 'Meter reading cannot be negative.';
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      txnDate: form.txnDate,
      quantity,
      meterReading: Number(form.meterReading),
      notes: form.notes.trim() || undefined,
    };
    if (form.source === 'DIRECT_PUMP') {
      payload.pricePerLitre = Number(form.pricePerLitre);
      payload.fuelStationId = form.fuelStationId ? Number(form.fuelStationId) : null;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await fuelTransactionsApi.update(id, payload);
      } else {
        await fuelTransactionsApi.create({ ...payload, source: form.source, assetType: form.assetType, assetId: form.assetId });
      }
      navigate('/fuel/issues', { state: { message: isEdit ? 'Fuel issue updated.' : 'Fuel issued.' } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/fuel/issues" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Back to fuel issues
        </Link>
      </div>
    );
  }

  if (isEdit ? !existing : vehicles === null || machinery === null) return <Spinner label="Loading" />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Link to="/fuel/issues" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Fuel issues
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{isEdit ? 'Edit fuel issue' : 'Issue fuel'}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <p className="mb-1.5 text-sm font-semibold text-steel-700">Where did the fuel come from?</p>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <SourceOption
              value="SITE_STOCK"
              current={form.source}
              onSelect={chooseSource}
              disabled={isEdit}
              title="From site stock"
              description="Filled from the cans at the site. Cost comes from the site's average price."
            />
            <SourceOption
              value="DIRECT_PUMP"
              current={form.source}
              onSelect={chooseSource}
              disabled={isEdit}
              title="Direct at pump"
              description="The vehicle filled its own tank at a fuel station. Enter the pump price."
            />
          </div>

          <div className="grid gap-x-6 sm:grid-cols-2">
            {isEdit ? (
              <div className="sm:col-span-2">
                <Field label="Asset" hint={`${SOURCE_LABEL[existing.source]} · the asset and source can't be changed after the entry is saved.`}>
                  {({ id: fieldId, describedBy }) => (
                    <Input id={fieldId} describedBy={describedBy} value={`${existing.assetLabel ?? existing.assetId} (${existing.assetId})`} disabled />
                  )}
                </Field>
              </div>
            ) : (
              <>
                <Field label="Asset type" required>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.assetType} onChange={update('assetType')}>
                      <option value="VEHICLE">Vehicle</option>
                      <option value="MACHINERY">Machinery</option>
                    </Select>
                  )}
                </Field>
                <Field label={form.assetType === 'VEHICLE' ? 'Vehicle' : 'Machine'} required error={errors.assetId}>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.assetId} onChange={update('assetId')}>
                      <option value="">{assetOptions.length ? 'Select an asset' : 'No active assets'}</option>
                      {assetOptions.map((a) => (
                        <option key={a.assetId} value={a.assetId}>
                          {assetDisplayName(form.assetType, a)} ({a.assetId}) · {a.fuelType}
                          {a.currentSiteId && siteNames[a.currentSiteId] ? ` — ${siteNames[a.currentSiteId]}` : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            )}
          </div>

          {siteStockBlocked && (
            <Alert tone="warning">
              {fuelType} isn't kept in site stock. Choose <strong>Direct at pump</strong> for this asset.
            </Alert>
          )}

          {!isEdit && form.source === 'SITE_STOCK' && selectedAsset && storable && stock && (
            <div className="mb-4 grid gap-4 rounded border border-steel-200 bg-steel-50 px-4 py-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">
                  {fuelType} at {siteNames[siteId] ?? 'this site'}
                </p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${stock.quantityOnHand > 0 ? 'text-steel-900' : 'text-danger-600'}`}>
                  {formatLitres(stock.quantityOnHand)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Avg. cost / L</p>
                <p className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{stock.quantityOnHand > 0 ? formatCurrency(stock.averageCost) : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">In transit</p>
                <p className="mt-1 text-lg font-semibold text-steel-500 tabular-nums">{formatLitres(stock.inTransitQuantity)}</p>
              </div>
            </div>
          )}

          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field label="Date" required error={errors.txnDate}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" max={todayDateOnly()} value={form.txnDate} onChange={update('txnDate')} />
              )}
            </Field>

            <Field
              label={meterLabel}
              required
              error={errors.meterReading}
              hint={!isEdit && !selectedAsset ? 'Select an asset first.' : reading != null ? `Current reading on the asset: ${formatNumber(reading)} ${unit}` : undefined}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={0}
                  step="any"
                  value={form.meterReading}
                  onChange={update('meterReading')}
                  disabled={!isEdit && !selectedAsset}
                />
              )}
            </Field>

            <Field
              label="Litres"
              required
              error={errors.quantity}
              hint={isEdit && form.source === 'SITE_STOCK' ? "Litres can't be changed on a fill from site stock — delete the entry and issue again." : undefined}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={0}
                  step="any"
                  value={form.quantity}
                  onChange={update('quantity')}
                  disabled={isEdit && form.source === 'SITE_STOCK'}
                />
              )}
            </Field>

            {form.source === 'DIRECT_PUMP' && (
              <>
                <Field label="Price per litre (₹)" required error={errors.pricePerLitre}>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.pricePerLitre} onChange={update('pricePerLitre')} />
                  )}
                </Field>
                <Field label="Fuel station" hint="Optional.">
                  {({ id: fieldId, describedBy }) => (
                    <Select id={fieldId} describedBy={describedBy} value={form.fuelStationId} onChange={update('fuelStationId')}>
                      <option value="">Not recorded</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.stationName}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            )}

            <div className="mb-4 sm:col-span-2">
              <p className="mb-1.5 text-sm font-semibold text-steel-700">{form.source === 'SITE_STOCK' && !isEdit ? 'Estimated cost' : 'Cost'}</p>
              <p className="text-lg font-semibold text-steel-900 tabular-nums">{formatCurrency(estimatedCost)}</p>
              {form.source === 'SITE_STOCK' && !isEdit && <p className="mt-0.5 text-xs text-steel-500">Litres × the site's average cost at the moment you save.</p>}
            </div>

            <div className="sm:col-span-2">
              <Field label="Notes">
                {({ id: fieldId, invalid, describedBy }) => (
                  <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.notes} onChange={update('notes')} maxLength={2000} />
                )}
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={siteStockBlocked}>
              {isEdit ? 'Save changes' : 'Issue fuel'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
