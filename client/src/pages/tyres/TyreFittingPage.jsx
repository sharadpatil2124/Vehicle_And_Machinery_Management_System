import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listAll, machineryApi, tyresApi, vehiclesApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import useActiveTyres from '../../hooks/useActiveTyres';
import { formatCurrency, formatDateOnly, formatNumber, formatRun, meterUnit, replacementNote, todayDateOnly } from '../../config/tyres';
import { assetOptionLabel } from '../../config/fuel';

function StatusBadge({ row }) {
  if (row.isOnAsset) return <Badge tone="brand">Active</Badge>;
  return (
    <div className="flex flex-col items-start">
      <Badge tone="neutral">{row.fitmentStatus === 'replaced' ? 'Replaced' : 'Off asset'}</Badge>
      <span className="mt-0.5 text-xs text-steel-500 tabular-nums">
        {formatDateOnly(row.removedAt)} at {formatRun(row.removeMeterReading, row.meterType)}
      </span>
    </div>
  );
}

function EditFittingModal({ row, onClose, onDone }) {
  const [form, setForm] = useState({
    assetType: row.assetType,
    assetId: row.assetId,
    tyreTypeId: String(row.tyreTypeId),
    position: row.position,
    serialNumber: row.serialNumber ?? '',
    fittedAt: row.fittedAt,
    meterReading: String(row.fitMeterReading),
  });
  const [assets, setAssets] = useState({ VEHICLE: [], MACHINERY: [] });
  const [stock, setStock] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAll(vehiclesApi.list, { sort: 'registrationNumber:asc' }).then((r) => !cancelled && setAssets((a) => ({ ...a, VEHICLE: r.data }))).catch(() => {});
    listAll(machineryApi.list, { sort: 'rcpl:asc' }).then((r) => !cancelled && setAssets((a) => ({ ...a, MACHINERY: r.data }))).catch(() => {});
    tyresApi
      .stock({ siteId: row.siteId })
      .then((r) => !cancelled && setStock(r.data.rows.filter((s) => s.siteId === row.siteId)))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [row.siteId]);

  const isUsed = row.tyreCondition === 'used';
  const isOriginalAsset = form.assetType === row.assetType && form.assetId === row.assetId;
  const siteAssets = assets[form.assetType].filter((a) => a.currentSiteId === row.siteId);
  const asset = assets[form.assetType].find((a) => a.assetId === form.assetId) ?? null;
  const readingIsHours = isOriginalAsset ? row.meterType === 'HOURS' : form.assetType === 'MACHINERY' || Boolean(asset?.isHoursBased);
  const readingLabel = readingIsHours ? 'Current Hours' : 'Current KM';
  const assetNoun = form.assetType === 'VEHICLE' ? 'vehicle' : 'machine';
  const typeChanged = form.tyreTypeId !== String(row.tyreTypeId);
  const typeOptions = stock.filter((s) => s.tyreTypeId === row.tyreTypeId || (isUsed ? s.usedQuantity : s.newQuantity) > 0);
  const activeTyres = useActiveTyres(form.assetType, form.assetId);
  const occupant = activeTyres.find((f) => f.id !== row.id && f.position.toLowerCase() === form.position.trim().toLowerCase());

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const reading = Number(form.meterReading);
    const next = {
      assetId: form.assetId ? null : `Choose a ${assetNoun}.`,
      tyreTypeId: form.tyreTypeId ? null : 'Choose a tyre type.',
      position: form.position.trim() ? null : 'Enter a position.',
      fittedAt: !form.fittedAt ? 'Choose the fitting date.' : form.fittedAt > todayDateOnly() ? "Date can't be in the future." : null,
      meterReading: form.meterReading === '' || !Number.isFinite(reading) ? `Enter the ${readingLabel}.` : reading < 0 ? `${readingLabel} must be 0 or more.` : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await tyresApi.updateFitment(row.id, {
        assetType: form.assetType,
        assetId: form.assetId,
        tyreTypeId: Number(form.tyreTypeId),
        position: form.position.trim(),
        serialNumber: form.serialNumber.trim() || null,
        fittedAt: form.fittedAt,
        meterReading: reading,
      });
      onDone(`Tyre fitting updated for ${response.data.assetLabel} (${response.data.position}).`);
    } catch (err) {
      if (/can't be (lower|higher) than/.test(err.message)) setErrors((e) => ({ ...e, meterReading: err.message }));
      else if (/^Fitting date/.test(err.message)) setErrors((e) => ({ ...e, fittedAt: err.message }));
      else setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} wide title={`Edit tyre fitting — ${row.position}, ${row.assetLabel}`}>
      <form onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{error}</Alert>
        <div className="mb-4 rounded border border-steel-200 bg-steel-50 px-3 py-2 text-sm text-steel-700">
          {row.siteName ?? 'Site'} · {isUsed ? 'Returned (used) tyre' : 'New tyre'} · cost {formatCurrency(row.unitCost)}
        </div>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="Asset type" required>
            {({ id }) => (
              <Select id={id} value={form.assetType} onChange={(e) => setForm((f) => ({ ...f, assetType: e.target.value, assetId: '' }))}>
                <option value="VEHICLE">Vehicle</option>
                <option value="MACHINERY">Machinery</option>
              </Select>
            )}
          </Field>
          <Field label={form.assetType === 'VEHICLE' ? 'Vehicle' : 'Machine'} required error={errors.assetId}>
            {({ id, invalid, describedBy }) => (
              <Select id={id} invalid={invalid} describedBy={describedBy} value={form.assetId} onChange={update('assetId')}>
                <option value="">{`Choose a ${assetNoun}…`}</option>
                {form.assetType === row.assetType && !siteAssets.some((a) => a.assetId === row.assetId) && (
                  <option value={row.assetId} data-added={row.assetId}>
                    {row.assetLabel} ({row.assetId})
                  </option>
                )}
                {siteAssets.map((a) => (
                  <option key={a.id} value={a.assetId} data-added={a.id}>
                    {assetOptionLabel(form.assetType, a)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Tyre type" required error={errors.tyreTypeId} hint={typeChanged ? 'This tyre goes back to stock and one of the chosen type is taken instead. The cost is updated to match.' : undefined}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} describedBy={describedBy} value={form.tyreTypeId} onChange={update('tyreTypeId')}>
              <option value="">Choose a tyre type…</option>
              {!typeOptions.some((s) => s.tyreTypeId === row.tyreTypeId) && (
                <option value={row.tyreTypeId} data-added={row.tyreTypeId}>
                  {row.tyreTypeLabel} · {row.tyreSize}
                </option>
              )}
              {typeOptions.map((s) => (
                <option key={s.tyreTypeId} value={s.tyreTypeId} data-added={s.tyreTypeId}>
                  {s.tyreTypeLabel} · {s.tyreSize} — {isUsed ? s.usedQuantity : s.newQuantity} in stock
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="Position" required error={errors.position} hint={occupant ? replacementNote(occupant, form.meterReading) : undefined}>
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={form.position} maxLength={50} onChange={update('position')} placeholder="e.g. Front left" />}
          </Field>
          <Field label="Serial number">
            {({ id }) => <Input id={id} value={form.serialNumber} maxLength={64} onChange={update('serialNumber')} placeholder="Optional" />}
          </Field>
          <Field label="Fitting date" required error={errors.fittedAt}>
            {({ id, invalid, describedBy }) => <Input id={id} type="date" invalid={invalid} describedBy={describedBy} value={form.fittedAt} max={todayDateOnly()} onChange={update('fittedAt')} />}
          </Field>
          <Field label={readingLabel} required error={errors.meterReading} hint={`The ${readingIsHours ? 'hour meter' : 'odometer'} reading at the time of fitting.`}>
            {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.meterReading} onChange={update('meterReading')} />}
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TyreFittingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', assetType: '', siteId: '', page: 1, sort: 'fittedAt:desc' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      const response = await tyresApi.fitments({
        search: active.search || undefined,
        assetType: active.assetType || undefined,
        siteId: active.siteId || undefined,
        page: active.page,
        sort: active.sort,
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      return { ...f, sort: `${field}:${currentField === field && currentDirection === 'desc' ? 'asc' : 'desc'}` };
    });
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  const columns = [
    {
      key: 'asset',
      label: 'Asset',
      render: (r) => {
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-steel-900">{r.assetLabel}</span>
            <span className="text-xs text-steel-500">
              {r.assetId} · {r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'type',
      label: 'Tyre type',
      render: (r) => (
        <div className="flex flex-col">
          <span>{r.tyreTypeLabel}</span>
          <span className="text-xs text-steel-500">
            {r.tyreSize}
            {r.serialNumber ? ` · SN ${r.serialNumber}` : ''}
            {r.tyreCondition === 'used' ? ' · used' : ''}
          </span>
        </div>
      ),
    },
    { key: 'siteName', label: 'Site', render: (r) => r.siteName ?? '—' },
    { key: 'position', label: 'Position' },
    {
      key: 'fittedAt',
      label: 'Fitted',
      sortable: true,
      render: (r) => (
        <div className="flex flex-col">
          <span>{formatDateOnly(r.fittedAt)}</span>
          <span className="text-xs text-steel-500 tabular-nums">
            at {formatNumber(r.fitMeterReading)} {meterUnit(r.meterType)}
          </span>
        </div>
      ),
    },
    { key: 'run', label: 'Run', align: 'right', render: (r) => <span className="tabular-nums">{formatRun(r.run, r.meterType)}</span> },
    { key: 'unitCost', label: 'Cost', align: 'right', render: (r) => <span className="tabular-nums">{formatCurrency(r.unitCost)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge row={r} /> },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.isOnAsset ? (
          <div className="flex items-center justify-end gap-3">
            <Can resource="TYRE" action="UPDATE">
              <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                Edit
              </Button>
            </Can>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre Fitting</h1>
          <p className="mt-1 text-steel-500">Which tyres are on which vehicles and machines.</p>
        </div>
        <Can resource="TYRE" action="CREATE">
          <Button as={Link} to="/tyres/fitting/new">
            Fit tyres
          </Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3' : ''}`}>
        <Input placeholder="Search asset, tyre or position..." value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <Select aria-label="Asset type" value={filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)}>
          <option value="">Vehicles &amp; machinery</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
        </Select>
        {isAdmin && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading tyre fittings" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage={filters.search || filters.assetType || filters.siteId ? 'No tyre fittings match these filters.' : 'No tyres fitted yet. Click "Fit tyres" to start.'}
            />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      {editing && (
        <EditFittingModal
          key={editing.id}
          row={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
            load(filters);
          }}
        />
      )}
    </div>
  );
}
