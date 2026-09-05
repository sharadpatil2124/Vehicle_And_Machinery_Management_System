import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { machineryApi, sitesApi, complianceApi } from '../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import ComplianceFields, { EMPTY_COMPLIANCE } from '../components/ComplianceFields';
import AssetDocumentFields from '../components/AssetDocumentFields';
import { FUEL_TYPE_OPTIONS } from '../config/fuelTypes';
import { complianceSlotsToFormValue } from '../config/compliance';

const EMPTY_FORM = {
  name: '',
  registrationNumber: '',
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
    registrationNumber: machine.registrationNumber ?? '',
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

  const [form, setForm] = useState(EMPTY_FORM);
  const [originalServiceIntervalHours, setOriginalServiceIntervalHours] = useState(null);
  const [compliance, setCompliance] = useState(EMPTY_COMPLIANCE);
  const [documentFiles, setDocumentFiles] = useState({});
  const [siteOptions, setSiteOptions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    machineryApi
      .get(id)
      .then(async (response) => {
        setForm(toFormValues(response.data));
        setOriginalServiceIntervalHours(response.data.serviceIntervalHours);
        const complianceResponse = await complianceApi.list('MACHINERY', response.data.assetId);
        setCompliance(complianceSlotsToFormValue(complianceResponse.data));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    sitesApi
      .list({ limit: 100 })
      .then((response) => setSiteOptions(response.data))
      .catch(() => {});
  }, []);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const nextServiceIntervalHours = Number(form.serviceIntervalHours);
    const intervalChanged = !isEdit || nextServiceIntervalHours !== originalServiceIntervalHours;

    const { serviceIntervalHours: _omit, currentSiteId, ...formWithoutInterval } = form;
    const payload = {
      ...formWithoutInterval,
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
      setSubmitError(err.message);
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
      <div className="mb-5">
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
          <div className="grid gap-x-6 sm:grid-cols-2">
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

            <Field label="Registration number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.registrationNumber}
                  onChange={update('registrationNumber')}
                  maxLength={32}
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
                  value={form.currentSiteId}
                  onChange={update('currentSiteId')}
                >
                  <option value="">Unassigned</option>
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id}>
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

          <div className="flex justify-end gap-2 pt-5">
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
