import { Field, Input, Select } from './ui';
import { ROAD_TAX_TYPE_OPTIONS } from '../config/compliance';

export const EMPTY_COMPLIANCE = {
  roadTax: { roadTaxType: '', expiryDate: '' },
  nationalPermit: { expiryDate: '' },
  insurance: { startDate: '', expiryDate: '' },
  statePermit: { startDate: '', expiryDate: '' },
  puc: { startDate: '', expiryDate: '' },
};

/**
 * Insurance, Permit (State) and PUC each have a start date and an end date.
 * The end date must be strictly after the start date — not before it, and not
 * the same day either.
 *
 * Dates come from <input type="date"> as "YYYY-MM-DD" strings, so they can be
 * compared directly with < / === (no need to parse them into Date objects).
 */
function dateRangeError(startDate, expiryDate) {
  if (!startDate || !expiryDate) return null;
  if (expiryDate < startDate) return 'End date cannot be before the start date';
  if (expiryDate === startDate) return 'End date cannot be the same as the start date';
  return null;
}

/**
 * The current validation errors for the three date-range compliance fields,
 * keyed the same way as `value` itself: { insurance, statePermit, puc }.
 * Each is either an error message or null.
 *
 * Exported so the form pages (VehicleFormPage, MachineryFormPage) can check
 * this before submitting — the fields below already show the same message
 * inline, so submission is simply blocked rather than repeating the message.
 */
export function getComplianceDateErrors(value) {
  return {
    insurance: dateRangeError(value.insurance.startDate, value.insurance.expiryDate),
    statePermit: dateRangeError(value.statePermit.startDate, value.statePermit.expiryDate),
    puc: dateRangeError(value.puc.startDate, value.puc.expiryDate),
  };
}

function Row({ title, children }) {
  return (
    <div className="border-b border-steel-100 py-4 last:border-b-0">
      <p className="mb-2 text-sm font-medium text-steel-700">{title}</p>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function ComplianceFields({ value, onChange }) {
  const dateErrors = getComplianceDateErrors(value);

  function updateField(key, field) {
    return (event) => onChange({ ...value, [key]: { ...value[key], [field]: event.target.value } });
  }

  return (
    <div className="mt-6 border-t border-steel-200 pt-5">
      <h2 className="mb-3 text-sm font-semibold text-steel-900">Compliance</h2>

      <Row title="Road Tax">
        <Field label="Road tax type">
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={value.roadTax.roadTaxType}
              onChange={updateField('roadTax', 'roadTaxType')}
            >
              <option value="">Not entered</option>
              {ROAD_TAX_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {value.roadTax.roadTaxType === 'OTHER' && (
          <Field label="Road tax expiry date">
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                invalid={invalid}
                describedBy={describedBy}
                type="date"
                value={value.roadTax.expiryDate}
                onChange={updateField('roadTax', 'expiryDate')}
              />
            )}
          </Field>
        )}
      </Row>

      <Row title="National Permit">
        <Field label="National permit expiry date">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.nationalPermit.expiryDate}
              onChange={updateField('nationalPermit', 'expiryDate')}
            />
          )}
        </Field>
      </Row>

      <Row title="Insurance">
        <Field label="Insurance start date">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.insurance.startDate}
              onChange={updateField('insurance', 'startDate')}
            />
          )}
        </Field>
        <Field label="Insurance end date" error={dateErrors.insurance}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.insurance.expiryDate}
              onChange={updateField('insurance', 'expiryDate')}
            />
          )}
        </Field>
      </Row>

      <Row title="Permit (State)">
        <Field label="State permit start date">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.statePermit.startDate}
              onChange={updateField('statePermit', 'startDate')}
            />
          )}
        </Field>
        <Field label="State permit end date" error={dateErrors.statePermit}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.statePermit.expiryDate}
              onChange={updateField('statePermit', 'expiryDate')}
            />
          )}
        </Field>
      </Row>

      <Row title="PUC">
        <Field label="PUC start date">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.puc.startDate}
              onChange={updateField('puc', 'startDate')}
            />
          )}
        </Field>
        <Field label="PUC end date" error={dateErrors.puc}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.puc.expiryDate}
              onChange={updateField('puc', 'expiryDate')}
            />
          )}
        </Field>
      </Row>
    </div>
  );
}
