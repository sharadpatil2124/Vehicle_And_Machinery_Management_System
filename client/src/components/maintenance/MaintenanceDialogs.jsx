import { useEffect, useMemo, useState } from 'react';
import { machineryApi, maintenanceApi, vehiclesApi, listAll } from '../../api/client';
import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import DeleteWordModal from '../DeleteWordModal';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../config/permissions';
import { assetDisplayName, formatNumber, meterTypeForAsset, meterUnitLabel } from '../../config/fuel';
import {
  MAINTENANCE_TYPE,
  elapsedMinutes,
  formatDateTime,
  formatDuration,
  fromDateTimeLocal,
  isInFuture,
  toDateTimeLocal,
} from '../../config/maintenance';

const textareaClasses = [
  'w-full rounded border px-3 py-1.5 text-sm text-steel-900 placeholder:text-steel-300',
  'focus:outline-none focus:ring-2',
].join(' ');

function TextArea({ invalid, describedBy, ...props }) {
  return (
    <textarea
      rows={3}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`${textareaClasses} ${
        invalid
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30'
          : 'border-steel-200 focus:border-brand-600 focus:ring-brand-600/25'
      }`}
      {...props}
    />
  );
}

function meterLabel(meterType) {
  if (meterType === 'HOURS') return 'Hour meter reading';
  if (meterType === 'KM') return 'Odometer reading (KM)';
  return 'Meter reading';
}

function toInput(value) {
  return value === null || value === undefined ? '' : String(value);
}

function toPayloadNumber(value) {
  return value === '' ? null : Number(value);
}

function validateCosts(form, found) {
  const labour = form.labourCost === '' ? null : Number(form.labourCost);
  const total = form.totalCost === '' ? null : Number(form.totalCost);
  if (labour !== null && !(labour >= 0)) found.labourCost = 'Labour cost cannot be negative.';
  if (total !== null && !(total >= 0)) found.totalCost = 'Total cost cannot be negative.';
  if (labour !== null && total !== null && total < labour) found.totalCost = 'Total cost cannot be less than the labour cost.';
}

function validateTimeline({ reportedAt, startedAt, completedAt }, found) {
  for (const [key, value] of Object.entries({ reportedAt, startedAt, completedAt })) {
    if (value && isInFuture(value)) found[key] = 'This cannot be in the future.';
  }
  if (startedAt && reportedAt && startedAt < reportedAt) found.startedAt = 'Work cannot start before it was reported.';
  if (completedAt && completedAt < (startedAt || reportedAt)) found.completedAt = 'Completion cannot be before work started.';
}

function CostFields({ form, errors, update, locked = {} }) {
  return (
    <>
      <Field label="Labour cost (₹)" error={errors.labourCost} hint={locked.labourCost ? 'Already saved. Only an Admin can change it.' : 'Optional.'}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.labourCost} onChange={update('labourCost')} disabled={locked.labourCost} />
        )}
      </Field>
      <Field label="Total cost (₹)" error={errors.totalCost} hint={locked.totalCost ? 'Already saved. Only an Admin can change it.' : 'Optional. Labour plus anything else spent.'}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.totalCost} onChange={update('totalCost')} disabled={locked.totalCost} />
        )}
      </Field>
    </>
  );
}

function useFormState(initial) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});

  function update(field) {
    return (event) => {
      const value = event.target.value;
      setForm((f) => (field === 'assetType' ? { ...f, assetType: value, assetId: '' } : { ...f, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    };
  }

  return { form, errors, setErrors, update };
}

function MaintenanceFormModal({ record, preset, onClose, onDone }) {
  const isEdit = Boolean(record);
  const fixedAsset = isEdit ? record : preset?.assetId ? preset : null;

  const { form, errors, setErrors, update } = useFormState(
    isEdit
      ? {
          type: record.type,
          description: record.description,
          reportedAt: toDateTimeLocal(record.reportedAt),
          startedAt: record.startedAt ? toDateTimeLocal(record.startedAt) : '',
          completedAt: record.completedAt ? toDateTimeLocal(record.completedAt) : '',
          meterReading: toInput(record.meterReading),
        }
      : {
          type: preset?.type ?? 'breakdown',
          assetType: preset?.assetType ?? 'VEHICLE',
          assetId: preset?.assetId ?? '',
          description: '',
          reportedAt: toDateTimeLocal(),
          meterReading: '',
        }
  );
  const [vehicles, setVehicles] = useState(null);
  const [machinery, setMachinery] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fixedAsset) return;
    listAll(vehiclesApi.list).then((r) => setVehicles(r.data)).catch(() => setVehicles([]));
    listAll(machineryApi.list, { sort: 'rcpl:asc' }).then((r) => setMachinery(r.data)).catch(() => setMachinery([]));
  }, [fixedAsset]);

  const assetOptions = useMemo(
    () => ((form.assetType === 'VEHICLE' ? vehicles : machinery) ?? []).filter((a) => a.status === 'active'),
    [vehicles, machinery, form.assetType]
  );
  const selectedAsset = assetOptions.find((a) => a.assetId === form.assetId) ?? null;

  const meterType = fixedAsset ? fixedAsset.meterType : selectedAsset ? meterTypeForAsset(form.assetType, selectedAsset) : null;
  const meterLocked = isEdit && record.type === 'preventive' && record.stage === 'resolved';
  const typeLabel = MAINTENANCE_TYPE[form.type]?.label.toLowerCase();

  function validate() {
    const found = {};
    if (!isEdit && !form.assetId) found.assetId = 'Select an asset.';
    if (!form.description.trim()) found.description = 'Describe the work or the problem.';
    if (!form.reportedAt) found.reportedAt = 'Enter when it was reported.';
    if (isEdit && record.stage !== 'reported' && !form.startedAt) found.startedAt = 'Enter when work started.';
    if (isEdit && record.stage === 'resolved' && !form.completedAt) found.completedAt = 'Enter when it was completed.';
    validateTimeline(form, found);
    if (form.meterReading !== '' && !(Number(form.meterReading) >= 0)) found.meterReading = 'Meter reading cannot be negative.';
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      description: form.description.trim(),
      reportedAt: fromDateTimeLocal(form.reportedAt),
    };
    if (!meterLocked) payload.meterReading = toPayloadNumber(form.meterReading);

    setSubmitting(true);
    try {
      if (isEdit) {
        if (record.stage !== 'reported') payload.startedAt = fromDateTimeLocal(form.startedAt);
        if (record.stage === 'resolved') payload.completedAt = fromDateTimeLocal(form.completedAt);
        await maintenanceApi.update(record.id, payload);
        onDone('Maintenance record updated.');
      } else {
        await maintenanceApi.create({ ...payload, type: form.type, assetType: form.assetType, assetId: form.assetId });
        onDone(form.type === 'breakdown' ? 'Breakdown reported.' : 'Preventive maintenance scheduled.');
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit
    ? `Edit ${typeLabel} maintenance`
    : preset?.type === 'breakdown'
      ? 'Report a breakdown'
      : preset?.type === 'preventive'
        ? 'Schedule preventive maintenance'
        : 'Record maintenance';

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={title}
      description={fixedAsset ? `${fixedAsset.assetLabel ?? fixedAsset.assetId} (${fixedAsset.assetId})` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="maintenance-form" loading={submitting}>
            {isEdit ? 'Save changes' : form.type === 'breakdown' ? 'Report breakdown' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form id="maintenance-form" onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{submitError}</Alert>

        <div className="grid gap-x-4 sm:grid-cols-2">
          {!isEdit && !preset?.type && (
            <div className="sm:col-span-2">
              <Field label="Maintenance type" required>
                {({ id, describedBy }) => (
                  <Select id={id} describedBy={describedBy} value={form.type} onChange={update('type')}>
                    <option value="breakdown">Breakdown — an unplanned failure</option>
                    <option value="preventive">Preventive — a planned service</option>
                  </Select>
                )}
              </Field>
            </div>
          )}

          {!fixedAsset && (
            <>
              <Field label="Asset type" required>
                {({ id, describedBy }) => (
                  <Select id={id} describedBy={describedBy} value={form.assetType} onChange={update('assetType')}>
                    <option value="VEHICLE">Vehicle</option>
                    <option value="MACHINERY">Machinery</option>
                  </Select>
                )}
              </Field>
              <Field label={form.assetType === 'VEHICLE' ? 'Vehicle' : 'Machine'} required error={errors.assetId}>
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={form.assetId} onChange={update('assetId')} disabled={vehicles === null || machinery === null}>
                    <option value="">{vehicles === null || machinery === null ? 'Loading…' : assetOptions.length ? 'Select an asset' : 'No active assets'}</option>
                    {assetOptions.map((a) => (
                      <option key={a.assetId} value={a.assetId} data-added={a.id}>
                        {assetDisplayName(form.assetType, a)} ({a.assetId})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          )}

          <div className="sm:col-span-2">
            <Field label={form.type === 'breakdown' ? 'What went wrong?' : 'Work to be done'} required error={errors.description}>
              {({ id, invalid, describedBy }) => (
                <TextArea id={id} invalid={invalid} describedBy={describedBy} value={form.description} onChange={update('description')} maxLength={2000} />
              )}
            </Field>
          </div>

          <Field
            label="Reported at"
            required
            error={errors.reportedAt}
            hint={form.type === 'breakdown' ? 'Downtime is counted from this moment until the breakdown is resolved.' : undefined}
          >
            {({ id, invalid, describedBy }) => (
              <Input id={id} invalid={invalid} describedBy={describedBy} type="datetime-local" max={toDateTimeLocal()} value={form.reportedAt} onChange={update('reportedAt')} />
            )}
          </Field>

          <Field
            label={meterLabel(meterType)}
            error={errors.meterReading}
            hint={
              meterLocked
                ? "Locked — this reading already updated the asset's service schedule."
                : !fixedAsset && !selectedAsset
                  ? 'Select an asset first.'
                  : 'Optional.'
            }
          >
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                invalid={invalid}
                describedBy={describedBy}
                type="number"
                min={0}
                step="any"
                value={form.meterReading}
                onChange={update('meterReading')}
                disabled={meterLocked || (!fixedAsset && !selectedAsset)}
              />
            )}
          </Field>

          {isEdit && record.stage !== 'reported' && (
            <Field label="Work started at" required error={errors.startedAt}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} describedBy={describedBy} type="datetime-local" max={toDateTimeLocal()} value={form.startedAt} onChange={update('startedAt')} />
              )}
            </Field>
          )}
          {isEdit && record.stage === 'resolved' && (
            <Field label="Completed at" required error={errors.completedAt}>
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} describedBy={describedBy} type="datetime-local" max={toDateTimeLocal()} value={form.completedAt} onChange={update('completedAt')} />
              )}
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}

function StageModal({ kind, record, onClose, onDone }) {
  const resolving = kind === 'resolve';
  const isPreventive = record.type === 'preventive';
  const needsMeter = resolving && isPreventive;
  const { role } = useAuth();
  const canCorrectCost = hasPermission(role, 'MAINTENANCE', 'UPDATE_COST');
  const lockedCosts = { labourCost: !canCorrectCost && record.labourCost != null, totalCost: !canCorrectCost && record.totalCost != null };
  const unit = meterUnitLabel(record.meterType);

  const { form, errors, setErrors, update } = useFormState({
    at: toDateTimeLocal(),
    performedBy: record.performedBy ?? '',
    meterReading: toInput(record.meterReading),
    labourCost: toInput(record.labourCost),
    totalCost: toInput(record.totalCost),
  });
  const [assetReading, setAssetReading] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!needsMeter || !record.assetRecordId) return;
    const load = record.assetType === 'VEHICLE' ? vehiclesApi.get : machineryApi.get;
    load(record.assetRecordId)
      .then((r) => setAssetReading(record.meterType === 'HOURS' ? r.data.currentHours : r.data.currentKM))
      .catch(() => setAssetReading(null));
  }, [needsMeter, record.assetRecordId, record.assetType, record.meterType]);

  const reportedLocal = toDateTimeLocal(record.reportedAt);
  const startedLocal = record.startedAt ? toDateTimeLocal(record.startedAt) : '';

  function validate() {
    const found = {};
    if (!form.at) found.at = resolving ? 'Enter when it was completed.' : 'Enter when work started.';
    else if (isInFuture(form.at)) found.at = 'This cannot be in the future.';
    else if (form.at < (startedLocal || reportedLocal)) {
      found.at = resolving ? 'Completion cannot be before work started.' : 'Work cannot start before it was reported.';
    }
    if (needsMeter) {
      if (form.meterReading === '') found.meterReading = `Enter the ${unit} reading at completion.`;
      else if (!(Number(form.meterReading) >= 0)) found.meterReading = 'Meter reading cannot be negative.';
      else if (assetReading !== null && Number(form.meterReading) < assetReading) {
        found.meterReading = `Cannot be lower than the asset's current reading (${formatNumber(assetReading)} ${unit}).`;
      }
    } else if (resolving && form.meterReading !== '' && !(Number(form.meterReading) >= 0)) {
      found.meterReading = 'Meter reading cannot be negative.';
    }
    if (resolving) validateCosts(form, found);
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      stage: resolving ? 'resolved' : 'in_progress',
      at: fromDateTimeLocal(form.at),
    };
    if (!resolving) payload.performedBy = form.performedBy.trim() || null;
    if (resolving) {
      payload.meterReading = toPayloadNumber(form.meterReading);
      payload.labourCost = toPayloadNumber(form.labourCost);
      payload.totalCost = toPayloadNumber(form.totalCost);
    }

    setSubmitting(true);
    try {
      await maintenanceApi.changeStage(record.id, payload);
      onDone(
        !resolving
          ? 'Work started.'
          : isPreventive
            ? "Preventive maintenance completed — the asset's next service target has been recalculated."
            : 'Breakdown resolved.'
      );
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const downtimePreview =
    resolving && !isPreventive && form.at ? formatDuration(elapsedMinutes(record.reportedAt, new Date(form.at))) : null;

  return (
    <Modal
      open
      wide={resolving}
      onClose={onClose}
      title={resolving ? (isPreventive ? 'Complete preventive maintenance' : 'Resolve breakdown') : 'Start work'}
      description={`${record.assetLabel ?? record.assetId} (${record.assetId}) · reported ${formatDateTime(record.reportedAt)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="maintenance-stage-form" loading={submitting}>
            {resolving ? (isPreventive ? 'Complete' : 'Resolve') : 'Start work'}
          </Button>
        </>
      }
    >
      <form id="maintenance-stage-form" onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{submitError}</Alert>
        <p className="mb-3 text-sm text-steel-600">{record.description}</p>

        <div className={resolving ? 'grid gap-x-4 sm:grid-cols-2' : ''}>
          <Field label={resolving ? 'Completed at' : 'Work started at'} required error={errors.at}>
            {({ id, invalid, describedBy }) => (
              <Input id={id} invalid={invalid} describedBy={describedBy} type="datetime-local" max={toDateTimeLocal()} value={form.at} onChange={update('at')} />
            )}
          </Field>

          {resolving && (
            <Field
              label={meterLabel(record.meterType)}
              required={needsMeter}
              error={errors.meterReading}
              hint={
                needsMeter
                  ? assetReading !== null
                    ? `Current reading on the asset: ${formatNumber(assetReading)} ${unit}. The next service target becomes this reading plus the service interval.`
                    : 'The next service target becomes this reading plus the service interval.'
                  : 'Optional.'
              }
            >
              {({ id, invalid, describedBy }) => (
                <Input id={id} invalid={invalid} describedBy={describedBy} type="number" min={0} step="any" value={form.meterReading} onChange={update('meterReading')} />
              )}
            </Field>
          )}

          {!resolving && (
            <Field label="Performed by" hint="Optional. Mechanic, team or workshop.">
              {({ id, describedBy }) => <Input id={id} describedBy={describedBy} value={form.performedBy} onChange={update('performedBy')} maxLength={150} />}
            </Field>
          )}

          {resolving && (
            <>
              {downtimePreview && (
                <div className="mb-3 sm:col-span-2">
                  <p className="mb-1.5 text-sm font-semibold text-steel-700">Downtime</p>
                  <p className="text-lg font-semibold text-steel-900 tabular-nums">{downtimePreview}</p>
                  <p className="mt-0.5 text-xs text-steel-500">From when it was reported until the completion time above.</p>
                </div>
              )}
              <CostFields form={form} errors={errors} update={update} locked={lockedCosts} />
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

function CostModal({ record, onClose, onDone }) {
  const { form, errors, setErrors, update } = useFormState({
    labourCost: toInput(record.labourCost),
    totalCost: toInput(record.totalCost),
  });
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = {};
    validateCosts(form, found);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await maintenanceApi.correctCost(record.id, {
        labourCost: toPayloadNumber(form.labourCost),
        totalCost: toPayloadNumber(form.totalCost),
      });
      onDone('Maintenance cost corrected.');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit maintenance cost"
      description={`${record.assetLabel ?? record.assetId} (${record.assetId}). Only the cost changes: the stage, dates, meter reading and the asset stay as they are.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="maintenance-cost-form" loading={submitting}>
            Save cost
          </Button>
        </>
      }
    >
      <form id="maintenance-cost-form" onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{submitError}</Alert>
        <CostFields form={form} errors={errors} update={update} />
      </form>
    </Modal>
  );
}

function DeleteDialog({ record, onClose, onDone }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await maintenanceApi.remove(record.id, 'DELETE');
      onDone('Maintenance record deleted.');
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  const resetsNothing =
    record.type === 'preventive' && record.stage === 'resolved'
      ? " The asset's meter reading and next service target stay as they are."
      : '';

  return (
    <DeleteWordModal
      open
      title="Delete this maintenance record?"
      description={`${MAINTENANCE_TYPE[record.type]?.label} maintenance for ${record.assetLabel ?? record.assetId}, reported ${formatDateTime(record.reportedAt)}.${resetsNothing}`}
      onCancel={onClose}
      onConfirm={handleConfirm}
      pending={pending}
      error={error}
    />
  );
}

export default function MaintenanceDialogs({ dialog, onClose, onDone }) {
  if (!dialog) return null;
  const { kind, record, preset } = dialog;

  if (kind === 'create' || kind === 'edit') {
    return <MaintenanceFormModal record={kind === 'edit' ? record : null} preset={preset} onClose={onClose} onDone={onDone} />;
  }
  if (kind === 'start' || kind === 'resolve') {
    return <StageModal kind={kind} record={record} onClose={onClose} onDone={onDone} />;
  }
  if (kind === 'cost') {
    return <CostModal record={record} onClose={onClose} onDone={onDone} />;
  }
  if (kind === 'delete') {
    return <DeleteDialog record={record} onClose={onClose} onDone={onDone} />;
  }
  return null;
}
