import { Field, Input, Select } from './ui';
import { ROAD_TAX_TYPE_OPTIONS } from '../config/compliance';

export const EMPTY_COMPLIANCE = {
  roadTax: { roadTaxType: '', expiryDate: '' },
  nationalPermit: { expiryDate: '' },
  insurance: { startDate: '', expiryDate: '' },
  statePermit: { startDate: '', expiryDate: '' },
  puc: { startDate: '', expiryDate: '' },
};

function Row({ title, children }) {
  return (
    <div className="border-b border-steel-100 py-4 last:border-b-0">
      <p className="mb-2 text-sm font-medium text-steel-700">{title}</p>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function ComplianceFields({ value, onChange }) {
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
        <Field label="Insurance end date">
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
        <Field label="State permit end date">
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
        <Field label="PUC end date">
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
