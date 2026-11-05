import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { machineryApi, sitesApi, complianceApi, listAll } from '../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import ComplianceFields, { EMPTY_COMPLIANCE, getComplianceDateErrors } from '../components/ComplianceFields';
import AssetDocumentFields from '../components/AssetDocumentFields';
import { FUEL_TYPE_OPTIONS } from '../config/fuelTypes';
import { complianceSlotsToFormValue } from '../config/compliance';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../config/permissions';

const RCPL_TAKEN = 'This RCPL is already in use by another machine';

const EMPTY_FORM = {
  name: '',
  rcpl: '',
  type: '',
  modelNumber: '',
  serialNumber: '',
  year: '',
  fuelType: '',
  currentHours: '',
  serviceIntervalHours: '',
  currentSiteId: '',
};

function toFormValues(machine) {
  return {
    name: machine.name ?? '',
    rcpl: machine.rcpl ?? '',
    type: machine.type,
    modelNumber: machine.modelNumber ?? '',
    serialNumber: machine.serialNumber ?? '',
    year: machine.year ?? '',
    fuelType: machine.fuelType,
    currentHours: machine.currentHours,
    serviceIntervalHours: machine.serviceIntervalHours,
    currentSiteId: machine.currentSiteId ?? '',
  };
}

export default function MachineryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const canChooseSite = hasPermission(role, 'SITE', 'ASSIGN');
  const lockedSiteId = user?.siteId ?? '';

  const [form, setForm] = useState(EMPTY_FORM);
  const [originalServiceIntervalHours, setOriginalServiceIntervalHours] = useState(null);
  const [compliance, setCompliance] = useState(EMPTY_COMPLIANCE);
  const [documentFiles, setDocumentFiles] = useState({});
  const [siteOptions, setSiteOptions] = useState([]);
  const [archivedSite, setArchivedSite] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rcplError, setRcplError] = useState(null);
  const latestRcpl = useRef('');

  useEffect(() => {
    if (!isEdit) return;
    machineryApi
      .get(id)
      .then(async (response) => {
        setForm(toFormValues(response.data));
        // The site list holds active sites only, so a site archived since the machine arrived needs adding.
        if (response.data.currentSiteId) {
          sitesApi
            .get(response.data.currentSiteId)
            .then((site) => setArchivedSite(site.data.status === 'archived' ? site.data : null))
            .catch(() => {});
        }
        latestRcpl.current = response.data.rcpl ?? '';
        setOriginalServiceIntervalHours(response.data.serviceIntervalHours);
        const complianceResponse = await complianceApi.list('MACHINERY', response.data.assetId);
        setCompliance(complianceSlotsToFormValue(complianceResponse.data));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    listAll(sitesApi.list)
      .then((response) => setSiteOptions(response.data))
      .catch(() => {});
  }, []);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  function updateRcpl(event) {
    const rcpl = event.target.value.toUpperCase();
    latestRcpl.current = rcpl;
    setForm((f) => ({ ...f, rcpl }));
    setRcplError(null);
  }

  async function findRcplError(value) {
    const rcpl = value.trim();
    if (!rcpl) return 'RCPL is required';
    try {
      const response = await machineryApi.rcplAvailability({ rcpl, excludeId: isEdit ? id : undefined });
      return response.data.available ? null : RCPL_TAKEN;
    } catch {
      return null;
    }
  }

  async function handleRcplBlur() {
    const checked = form.rcpl;
    if (!checked.trim()) return;
    const message = await findRcplError(checked);
    if (latestRcpl.current === checked) setRcplError(message);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const complianceErrors = getComplianceDateErrors(compliance);
    if (Object.values(complianceErrors).some(Boolean)) {
      return;
    }

    const blankMeter = [['currentHours', 'Current hours'], ['serviceIntervalHours', 'Service interval (hours)']].find(
      ([field]) => String(form[field]).trim() === ''
    );
    if (blankMeter) {
      setSubmitError(`${blankMeter[1]} is required.`);
      return;
    }

    setSubmitting(true);

    const rcplProblem = await findRcplError(form.rcpl);
    if (rcplProblem) {
      setRcplError(rcplProblem);
      setSubmitting(false);
      return;
    }

    const nextServiceIntervalHours = Number(form.serviceIntervalHours);
    const intervalChanged = !isEdit || nextServiceIntervalHours !== originalServiceIntervalHours;

    const { serviceIntervalHours: _omit, currentSiteId, ...formWithoutInterval } = form;
    const payload = {
      ...formWithoutInterval,
      rcpl: form.rcpl.trim(),
      year: form.year === '' ? null : Number(form.year),
      currentHours: Number(form.currentHours),
      currentSiteId: currentSiteId === '' ? null : Number(currentSiteId),
      compliance,
      ...(intervalChanged ? { serviceIntervalHours: nextServiceIntervalHours } : {}),
    };

    try {
      const response = isEdit
        ? await machineryApi.update(id, payload)
        : await machineryApi.create(payload, documentFiles);
      navigate(`/machinery/${response.data.id}`);
    } catch (err) {
      if (/RCPL/.test(err.message)) setRcplError(err.message);
      else setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading machine" />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">
          {isEdit ? 'Edit machine' : 'Add machine'}
        </h1>
        <p className="mt-1 text-steel-500">
          {isEdit ? 'Update this machine’s details.' : 'Register a new hours-based asset.'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <h2 className="mb-3 text-sm font-semibold text-steel-900">Machine Details</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Machinery name">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.name}
                  onChange={update('name')}
                  maxLength={150}
                />
              )}
            </Field>

            <Field label="RCPL" required error={rcplError} hint="Unique for each machine. Saved in capital letters.">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.rcpl}
                  onChange={updateRcpl}
                  onBlur={handleRcplBlur}
                  maxLength={32}
                  autoCapitalize="characters"
                  required
                />
              )}
            </Field>

            <Field label="Type" required hint="e.g. Excavator, Crane, Loader">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.type}
                  onChange={update('type')}
                  maxLength={100}
                  required
                />
              )}
            </Field>

            <Field label="Fuel type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.fuelType}
                  onChange={update('fuelType')}
                  required
                >
                  <option value="">Select a fuel type</option>
                  {FUEL_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Year">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.year}
                  onChange={update('year')}
                />
              )}
            </Field>

            <Field label="Model number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.modelNumber}
                  onChange={update('modelNumber')}
                  maxLength={100}
                />
              )}
            </Field>

            <Field label="Chassis number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.serialNumber}
                  onChange={update('serialNumber')}
                  maxLength={100}
                />
              )}
            </Field>

            <Field label="Site">
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={canChooseSite ? form.currentSiteId : lockedSiteId}
                  onChange={update('currentSiteId')}
                  disabled={!canChooseSite}
                >
                  <option value="">Unassigned</option>
                  {archivedSite && (
                    <option value={archivedSite.id} data-added={archivedSite.id}>
                      {archivedSite.name} (archived)
                    </option>
                  )}
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id} data-added={site.id}>
                      {site.name}
                      {site.location ? ` — ${site.location}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Current hours" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.currentHours}
                  onChange={update('currentHours')}
                  required
                />
              )}
            </Field>

            <Field
              label="Service interval (hours)"
              required
              hint={isEdit ? 'Changing this recalculates the next service target.' : undefined}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={1}
                  step="0.01"
                  value={form.serviceIntervalHours}
                  onChange={update('serviceIntervalHours')}
                  required
                />
              )}
            </Field>
          </div>

          <ComplianceFields value={compliance} onChange={setCompliance} />

          {!isEdit && (
            <AssetDocumentFields assetType="MACHINERY" files={documentFiles} onChange={setDocumentFiles} />
          )}

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Create machine'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
