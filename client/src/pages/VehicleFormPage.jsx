import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { vehiclesApi, sitesApi, complianceApi } from '../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import ComplianceFields, { EMPTY_COMPLIANCE, getComplianceDateErrors } from '../components/ComplianceFields';
import AssetDocumentFields from '../components/AssetDocumentFields';
import { DOCUMENT_LABELS, getMissingMandatoryDocTypes } from '../config/assetDocuments';
import { VEHICLE_TYPE_OPTIONS, HOURS_BASED_VEHICLE_TYPE } from '../config/vehicleTypes';
import { FUEL_TYPE_OPTIONS } from '../config/fuelTypes';
import { complianceSlotsToFormValue } from '../config/compliance';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../config/permissions';

const EMPTY_FORM = {
  registrationNumber: '',
  type: '',
  modelNumber: '',
  chassisNumber: '',
  year: '',
  fuelType: '',
  currentKM: '',
  serviceIntervalKM: '',
  currentHours: '',
  serviceIntervalHours: '',
  currentSiteId: '',
};

function toFormValues(vehicle) {
  return {
    registrationNumber: vehicle.registrationNumber,
    type: vehicle.type,
    modelNumber: vehicle.modelNumber ?? '',
    chassisNumber: vehicle.chassisNumber ?? '',
    year: vehicle.year ?? '',
    fuelType: vehicle.fuelType,
    currentKM: vehicle.currentKM ?? '',
    serviceIntervalKM: vehicle.serviceIntervalKM ?? '',
    currentHours: vehicle.currentHours ?? '',
    serviceIntervalHours: vehicle.serviceIntervalHours ?? '',
    currentSiteId: vehicle.currentSiteId ?? '',
  };
}

export default function VehicleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // Choosing the site is an Admin job. A Supervisor works at a single site, so
  // the field below is locked to it (see server/src/services/siteAccess.js).
  const canChooseSite = hasPermission(role, 'SITE', 'ASSIGN');
  const lockedSiteId = user?.siteId ?? '';

  const [form, setForm] = useState(EMPTY_FORM);
  const isHeavy = form.type === HOURS_BASED_VEHICLE_TYPE;
  const [compliance, setCompliance] = useState(EMPTY_COMPLIANCE);
  const [siteOptions, setSiteOptions] = useState([]);
  const [documentFiles, setDocumentFiles] = useState({});
  const [showMissingDocs, setShowMissingDocs] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    vehiclesApi
      .get(id)
      .then(async (response) => {
        setForm(toFormValues(response.data));
        const complianceResponse = await complianceApi.list('VEHICLE', response.data.assetId);
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

    // Insurance / Permit (State) / PUC end dates must be after their start
    // dates. The errors already show inline next to each field (see
    // ComplianceFields), so submission is simply blocked here.
    const complianceErrors = getComplianceDateErrors(compliance);
    if (Object.values(complianceErrors).some(Boolean)) {
      return;
    }

    if (!isEdit) {
      const missing = getMissingMandatoryDocTypes('VEHICLE', documentFiles);
      if (missing.length > 0) {
        setShowMissingDocs(true);
        const noun = missing.length > 1 ? 'documents are' : 'document is';
        setSubmitError(`${missing.map((docType) => DOCUMENT_LABELS[docType]).join(' and ')} ${noun} required.`);
        return;
      }
    }

    setSubmitting(true);

    const {
      currentKM,
      serviceIntervalKM,
      currentHours,
      serviceIntervalHours,
      currentSiteId,
      ...formWithoutMeters
    } = form;

    const payload = {
      ...formWithoutMeters,
      year: form.year === '' ? null : Number(form.year),
      currentSiteId: currentSiteId === '' ? null : Number(currentSiteId),
      compliance,
      ...(isHeavy
        ? {
            currentHours: Number(currentHours),
            serviceIntervalHours: Number(serviceIntervalHours),
          }
        : {
            currentKM: Number(currentKM),
            serviceIntervalKM: Number(serviceIntervalKM),
          }),
    };

    try {
      const response = isEdit
        ? await vehiclesApi.update(id, payload)
        : await vehiclesApi.create(payload, documentFiles);
      navigate(`/vehicles/${response.data.id}`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading vehicle" />;

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
          {isEdit ? 'Edit vehicle' : 'Add vehicle'}
        </h1>
        <p className="mt-1 text-steel-500">
          {isEdit ? 'Update this vehicle’s details.' : 'Register a new vehicle.'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <h2 className="mb-3 text-sm font-semibold text-steel-900">Vehicle Details</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Field label="Registration number" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.registrationNumber}
                  onChange={update('registrationNumber')}
                  maxLength={32}
                  required
                />
              )}
            </Field>

            <Field label="Type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.type}
                  onChange={update('type')}
                  required
                >
                  <option value="">Select a type</option>
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
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
                  value={form.chassisNumber}
                  onChange={update('chassisNumber')}
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
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                      {site.location ? ` — ${site.location}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {isHeavy ? (
              <>
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
              </>
            ) : (
              <>
                <Field label="Current KM" required>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      describedBy={describedBy}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.currentKM}
                      onChange={update('currentKM')}
                      required
                    />
                  )}
                </Field>

                <Field
                  label="Service interval (KM)"
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
                      value={form.serviceIntervalKM}
                      onChange={update('serviceIntervalKM')}
                      required
                    />
                  )}
                </Field>
              </>
            )}
          </div>

          <ComplianceFields value={compliance} onChange={setCompliance} />

          {!isEdit && (
            <AssetDocumentFields
              assetType="VEHICLE"
              files={documentFiles}
              onChange={setDocumentFiles}
              showRequiredError={showMissingDocs}
            />
          )}

          <div className="flex justify-end gap-2 pt-5">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {isEdit ? 'Save changes' : 'Create vehicle'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
