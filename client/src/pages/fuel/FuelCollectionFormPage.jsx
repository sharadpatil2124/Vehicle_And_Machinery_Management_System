import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fuelCollectionsApi, fuelStationsApi, vehiclesApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { STORABLE_FUEL_TYPES, formatCurrency, formatLitres, todayDateOnly } from '../../config/fuel';

const EMPTY_ROW = { containerCount: '', litresPerContainer: '' };

function rowLitres(row) {
  const count = Number(row.containerCount);
  const litres = Number(row.litresPerContainer);
  return count > 0 && litres > 0 ? count * litres : 0;
}

function validate(form, rows, needsSite) {
  const errors = {};
  if (needsSite && !form.siteId) errors.siteId = 'Select the site this fuel is for.';
  if (!form.carrierAssetId) errors.carrierAssetId = 'Select the vehicle that carried the cans.';
  if (!form.fuelStationId) errors.fuelStationId = 'Select the fuel station.';
  if (!form.collectionDate) errors.collectionDate = 'Enter the date fuel was filled.';
  else if (form.collectionDate > todayDateOnly()) errors.collectionDate = 'The date cannot be in the future.';
  if (form.pricePerLitre === '') errors.pricePerLitre = 'Enter the rate from the pump bill.';
  else if (!(Number(form.pricePerLitre) > 0)) errors.pricePerLitre = 'Rate must be greater than 0.';
  const badRow = rows.findIndex(
    (row) => !(Number.isInteger(Number(row.containerCount)) && Number(row.containerCount) >= 1 && Number(row.litresPerContainer) > 0)
  );
  if (rows.length === 0 || badRow !== -1) {
    errors.containers =
      rows.length === 0 ? 'Add at least one row of cans.' : `Cans row ${badRow + 1}: enter a whole number of cans and the litres in each.`;
  }
  return errors;
}

export default function FuelCollectionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const [form, setForm] = useState({
    siteId: isAdmin ? '' : String(user?.siteId ?? ''),
    carrierAssetId: '',
    fuelStationId: '',
    fuelType: 'Diesel',
    collectionDate: todayDateOnly(),
    pricePerLitre: '',
    billNumber: '',
    driverName: '',
    notes: '',
  });
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [existing, setExisting] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [stations, setStations] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    vehiclesApi.list({ limit: 100 }).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    fuelStationsApi.list({ limit: 100 }).then((r) => setStations(r.data)).catch(() => setStations([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fuelCollectionsApi
      .get(id)
      .then((response) => {
        const c = response.data;
        setExisting(c);
        setForm({
          siteId: String(c.siteId),
          carrierAssetId: c.carrierAssetId ?? '',
          fuelStationId: String(c.fuelStationId),
          fuelType: c.fuelType,
          collectionDate: c.collectionDate,
          pricePerLitre: String(c.pricePerLitre),
          billNumber: c.billNumber ?? '',
          driverName: c.driverName ?? '',
          notes: c.notes ?? '',
        });
        setRows(c.containers.map((row) => ({ containerCount: String(row.containerCount), litresPerContainer: String(row.litresPerContainer) })));
      })
      .catch((err) => setLoadError(err.message));
  }, [id, isEdit]);

  const carriers = useMemo(
    () => (vehicles ?? []).filter((v) => v.status === 'active' && form.siteId && String(v.currentSiteId) === String(form.siteId)),
    [vehicles, form.siteId]
  );

  const totalLitres = Math.round(rows.reduce((sum, row) => sum + rowLitres(row), 0) * 1000) / 1000;
  const amount = totalLitres > 0 && Number(form.pricePerLitre) > 0 ? Math.round(totalLitres * Number(form.pricePerLitre) * 100) / 100 : null;

  function update(field) {
    return (event) => {
      const value = event.target.value;
      setForm((f) => (field === 'siteId' ? { ...f, siteId: value, carrierAssetId: '' } : { ...f, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    };
  }

  function updateRow(index, field) {
    return (event) => {
      const value = event.target.value;
      setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
      setErrors((e) => ({ ...e, containers: undefined }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate(form, rows, isAdmin && !isEdit);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      siteId: isAdmin && !isEdit ? Number(form.siteId) : undefined,
      carrierAssetId: form.carrierAssetId,
      fuelStationId: Number(form.fuelStationId),
      fuelType: form.fuelType,
      collectionDate: form.collectionDate,
      containers: rows.map((row) => ({ containerCount: Number(row.containerCount), litresPerContainer: Number(row.litresPerContainer) })),
      pricePerLitre: Number(form.pricePerLitre),
      billNumber: form.billNumber.trim() || undefined,
      driverName: form.driverName.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const response = isEdit ? await fuelCollectionsApi.update(id, payload) : await fuelCollectionsApi.create(payload);
      navigate(`/fuel/collections/${response.data.id}`, {
        state: { message: isEdit ? 'Collection updated.' : `${response.data.collectionNumber} recorded — it is in transit until the site receives it.` },
      });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        <Link to="/fuel/collections" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Back to fuel collections
        </Link>
      </div>
    );
  }

  if (vehicles === null || stations === null || (isEdit && !existing)) return <Spinner label="Loading" />;

  const locked = isEdit && existing.status !== 'in_transit';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <Link to={isEdit ? `/fuel/collections/${id}` : '/fuel/collections'} className="text-sm font-semibold text-brand-600 hover:underline">
          ← {isEdit ? existing.collectionNumber : 'Fuel collections'}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">{isEdit ? 'Edit fuel collection' : 'Record fuel collection'}</h1>
        <p className="mt-1 text-steel-500">Fuel filled into cans at the pump. It stays in transit, and can't be issued, until the site receives it.</p>
      </div>

      {locked && <Alert tone="warning">This collection is {existing.status.replace('_', ' ')} and can no longer be edited.</Alert>}
      {stations.length === 0 && (
        <Alert tone="warning">
          No fuel stations yet.{' '}
          {isAdmin ? (
            <Link to="/fuel/stations" className="font-semibold underline">
              Add the pump first
            </Link>
          ) : (
            'Ask your Admin to add the pump first.'
          )}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field label="Site" required error={errors.siteId} hint={!isAdmin ? 'Your site.' : isEdit ? "The site can't be changed." : undefined}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={update('siteId')} disabled={!isAdmin || isEdit}>
                  {isAdmin && !isEdit && <option value="">Select a site</option>}
                  {Object.entries(siteNames).map(([siteId, name]) => (
                    <option key={siteId} value={siteId}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Carrier vehicle"
              required
              error={errors.carrierAssetId}
              hint={!form.siteId ? 'Select a site first.' : carriers.length === 0 ? 'No active vehicles at this site.' : undefined}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.carrierAssetId} onChange={update('carrierAssetId')} disabled={!form.siteId || locked}>
                  <option value="">Select the vehicle</option>
                  {carriers.map((v) => (
                    <option key={v.assetId} value={v.assetId}>
                      {v.registrationNumber} ({v.assetId})
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Fuel station" required error={errors.fuelStationId}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.fuelStationId} onChange={update('fuelStationId')} disabled={locked}>
                  <option value="">Select the pump</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stationName}
                      {s.location ? ` — ${s.location}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Fuel type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.fuelType} onChange={update('fuelType')} disabled={locked}>
                  {STORABLE_FUEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Collection date" required error={errors.collectionDate}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" max={todayDateOnly()} value={form.collectionDate} onChange={update('collectionDate')} disabled={locked} />
              )}
            </Field>

            <Field label="Rate per litre (₹)" required error={errors.pricePerLitre} hint="As printed on the pump bill.">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.pricePerLitre} onChange={update('pricePerLitre')} disabled={locked} />
              )}
            </Field>
          </div>

          <div className="mt-2 border-t border-steel-200 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-steel-900">Cans</h2>
                <p className="text-xs text-steel-500">One row per can size, e.g. 5 cans × 35 L.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])} disabled={locked}>
                Add row
              </Button>
            </div>

            {errors.containers && <p className="mb-3 text-xs font-medium text-danger-600">{errors.containers}</p>}

            <div className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <div key={index} className="grid items-end gap-x-4 sm:grid-cols-[1fr_1fr_8rem_auto]">
                  <Field label={`Number of cans${rows.length > 1 ? ` (row ${index + 1})` : ''}`}>
                    {({ id: fieldId, describedBy }) => (
                      <Input id={fieldId} describedBy={describedBy} type="number" min={1} step={1} value={row.containerCount} onChange={updateRow(index, 'containerCount')} disabled={locked} />
                    )}
                  </Field>
                  <Field label="Litres in each can">
                    {({ id: fieldId, describedBy }) => (
                      <Input id={fieldId} describedBy={describedBy} type="number" min={0} step="any" value={row.litresPerContainer} onChange={updateRow(index, 'litresPerContainer')} disabled={locked} />
                    )}
                  </Field>
                  <p className="mb-4 py-2 text-sm text-steel-600 tabular-nums">= {formatLitres(rowLitres(row))}</p>
                  <div className="mb-4 py-2">
                    {rows.length > 1 && !locked && (
                      <button type="button" className="text-sm font-semibold text-danger-600 hover:underline" onClick={() => setRows((r) => r.filter((_, i) => i !== index))}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 grid gap-4 rounded border border-steel-200 bg-steel-50 px-4 py-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Total litres</p>
                <p className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{formatLitres(totalLitres)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Amount</p>
                <p className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{formatCurrency(amount)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-x-6 border-t border-steel-200 pt-5 sm:grid-cols-2">
            <Field label="Bill / receipt number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.billNumber} onChange={update('billNumber')} maxLength={64} disabled={locked} />
              )}
            </Field>
            <Field label="Driver name">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.driverName} onChange={update('driverName')} maxLength={150} disabled={locked} />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                {({ id: fieldId, invalid, describedBy }) => (
                  <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.notes} onChange={update('notes')} maxLength={2000} disabled={locked} />
                )}
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={locked || stations.length === 0}>
              {isEdit ? 'Save changes' : 'Record collection'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
