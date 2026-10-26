import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { REMOVAL_REASONS, formatCurrency, formatDateOnly, formatNumber, meterUnit, todayDateOnly } from '../../config/tyres';

function StatusBadge({ row }) {
  if (row.isOnAsset) return <Badge tone="brand">On asset</Badge>;
  return (
    <div className="flex flex-col items-start">
      <Badge tone={row.removalOutcome === 'scrapped' ? 'danger' : 'neutral'}>{row.removalOutcome === 'scrapped' ? 'Scrapped' : 'Returned'}</Badge>
      <span className="mt-0.5 text-xs text-steel-500">
        {formatDateOnly(row.removedAt)} · {row.removalReasonLabel}
      </span>
    </div>
  );
}

function RemoveTyreModal({ row, onClose, onDone }) {
  const open = row !== null;
  const unit = meterUnit(row?.meterType);
  const readingLabel = row?.meterType === 'HOURS' ? 'Current Hours' : 'Current KM';
  const [form, setForm] = useState({ removedAt: todayDateOnly(), meterReading: '', reason: '', outcome: 'scrapped', notes: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setForm({ removedAt: todayDateOnly(), meterReading: '', reason: '', outcome: 'scrapped', notes: '' });
    setErrors({});
    setError(null);
  }, [row]);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const reading = Number(form.meterReading);
    const next = {
      removedAt: !form.removedAt ? 'Choose a date.' : form.removedAt > todayDateOnly() ? "Date can't be in the future." : form.removedAt < row.fittedAt ? `Date can't be before the fitting date (${formatDateOnly(row.fittedAt)}).` : null,
      meterReading:
        form.meterReading === '' || !Number.isFinite(reading)
          ? `Enter the ${readingLabel}.`
          : reading < row.fitMeterReading
            ? `${readingLabel} can't be lower than ${formatNumber(row.fitMeterReading)} ${unit}, the reading recorded when this tyre was fitted on ${formatDateOnly(row.fittedAt)}.`
            : null,
      reason: form.reason ? null : 'Choose a reason.',
      notes: form.reason === 'OTHER' && !form.notes.trim() ? 'Add a short note explaining the reason.' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setError(null);
    try {
      await tyresApi.removeFitment(row.id, { removedAt: form.removedAt, meterReading: reading, reason: form.reason, outcome: form.outcome, notes: form.notes || null });
      onDone(`Tyre removed from ${row.assetLabel} (${row.position}) and ${form.outcome === 'scrapped' ? 'scrapped' : 'returned to stock'}.`);
    } catch (err) {
      if (/can't be lower than/.test(err.message)) setErrors((e) => ({ ...e, meterReading: err.message }));
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={row ? `Remove tyre — ${row.position}, ${row.assetLabel}` : ''}>
      {row && (
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{error}</Alert>
          <div className="mb-4 rounded border border-steel-200 bg-steel-50 px-3 py-2 text-sm text-steel-700">
            {row.tyreTypeLabel} · {row.tyreSize} — fitted {formatDateOnly(row.fittedAt)} at {formatNumber(row.fitMeterReading)} {unit}
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Removal date" required error={errors.removedAt}>
              {({ id, invalid, describedBy }) => <Input id={id} type="date" invalid={invalid} describedBy={describedBy} value={form.removedAt} max={todayDateOnly()} onChange={update('removedAt')} />}
            </Field>
            <Field label={readingLabel} required error={errors.meterReading} hint={`Type the ${row.meterType === 'HOURS' ? 'hour meter' : 'odometer'} reading at the time of removal.`}>
              {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.meterReading} onChange={update('meterReading')} />}
            </Field>
          </div>
          <Field label="Reason" required error={errors.reason}>
            {({ id, invalid, describedBy }) => (
              <Select id={id} invalid={invalid} describedBy={describedBy} value={form.reason} onChange={update('reason')}>
                <option value="">Choose a reason…</option>
                {REMOVAL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-sm font-semibold text-steel-700">What happens to the tyre?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['scrapped', 'Scrap it', "Finished, can't be used again."],
                ['returned', 'Return to stock', 'Kept as a used spare.'],
              ].map(([value, title, text]) => (
                <label key={value} className={`flex cursor-pointer gap-2 rounded border px-3 py-2 text-sm ${form.outcome === value ? 'border-brand-600 bg-brand-50' : 'border-steel-200'}`}>
                  <input type="radio" name="outcome" value={value} checked={form.outcome === value} onChange={update('outcome')} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold text-steel-900">{title}</span>
                    <span className="text-steel-500">{text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Note" required={form.reason === 'OTHER'} error={errors.notes}>
            {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={form.notes} maxLength={1000} onChange={update('notes')} placeholder="e.g. Sidewall cut, not repairable" />}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Remove tyre
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function TyreFittingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', assetType: '', siteId: '', status: 'on', page: 1, sort: 'fittedAt:desc' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [removing, setRemoving] = useState(null);
  const [undoing, setUndoing] = useState(null);
  const [undoPending, setUndoPending] = useState(false);
  const [undoError, setUndoError] = useState(null);

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
        status: active.status || undefined,
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

  async function handleUndo() {
    setUndoPending(true);
    setUndoError(null);
    try {
      await tyresApi.undoFitting(undoing.id, 'DELETE');
      setNotice(`Fitting undone — the ${undoing.position} tyre is back in stock.`);
      setUndoing(null);
      load(filters);
    } catch (err) {
      setUndoError(err.message);
    } finally {
      setUndoPending(false);
    }
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
    { key: 'unitCost', label: 'Cost', align: 'right', render: (r) => <span className="tabular-nums">{formatCurrency(r.unitCost)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge row={r} /> },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.isOnAsset ? (
          <div className="flex items-center justify-end gap-3">
            <Can resource="TYRE" action="UPDATE">
              <Button size="sm" variant="secondary" onClick={() => setRemoving(r)}>
                Remove
              </Button>
            </Can>
            <Can resource="TYRE" action="DELETE">
              <button
                type="button"
                className="text-xs font-semibold text-danger-600 hover:underline"
                onClick={() => {
                  setUndoError(null);
                  setUndoing(r);
                }}
              >
                Undo
              </button>
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

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
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
        <Select aria-label="Status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="on">On asset now</option>
          <option value="removed">Removed</option>
          <option value="scrapped">Scrapped</option>
          <option value="returned">Returned to stock</option>
          <option value="">All fittings</option>
        </Select>
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
              emptyMessage={filters.search || filters.assetType || filters.siteId || filters.status !== 'on' ? 'No tyre fittings match these filters.' : 'No tyres fitted yet. Click "Fit tyres" to start.'}
            />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      <RemoveTyreModal
        row={removing}
        onClose={() => setRemoving(null)}
        onDone={(message) => {
          setRemoving(null);
          setNotice(message);
          load(filters);
        }}
      />
      <DeleteWordModal
        open={undoing !== null}
        title="Undo this fitting?"
        description={undoing ? `Use this only for a fitting entered by mistake. The ${undoing.position} tyre on ${undoing.assetLabel} goes back to stock and this record is deleted.` : ''}
        onCancel={() => setUndoing(null)}
        onConfirm={handleUndo}
        pending={undoPending}
        error={undoError}
        confirmLabel="Undo fitting"
      />
    </div>
  );
}
