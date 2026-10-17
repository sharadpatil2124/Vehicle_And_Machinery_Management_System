import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Field, Input, Select } from './ui';
import { ROAD_TAX_TYPE_OPTIONS } from '../config/compliance';

export const EMPTY_COMPLIANCE = {
  roadTax: { roadTaxType: '', expiryDate: '', documentNumber: '' },
  nationalPermit: { expiryDate: '', documentNumber: '' },
  insurance: { startDate: '', expiryDate: '', documentNumber: '' },
  statePermit: { startDate: '', expiryDate: '', documentNumber: '' },
  fitness: { startDate: '', expiryDate: '', documentNumber: '' },
};

function dateRangeError(startDate, expiryDate) {
  if (!startDate || !expiryDate) return null;
  if (expiryDate < startDate) return 'End date cannot be before the start date';
  if (expiryDate === startDate) return 'End date cannot be the same as the start date';
  return null;
}

export function getComplianceDateErrors(value) {
  return {
    insurance: dateRangeError(value.insurance.startDate, value.insurance.expiryDate),
    statePermit: dateRangeError(value.statePermit.startDate, value.statePermit.expiryDate),
    fitness: dateRangeError(value.fitness.startDate, value.fitness.expiryDate),
  };
}

function Row({ title, children }) {
  return (
    <div className="border-b border-steel-100 py-4 last:border-b-0">
      <p className="mb-2 text-sm font-medium text-steel-700">{title}</p>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export default function ComplianceFields({ value, onChange }) {
  const dateErrors = getComplianceDateErrors(value);
  const sectionRef = useRef(null);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#compliance') sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [hash]);

  function updateField(key, field) {
    return (event) => onChange({ ...value, [key]: { ...value[key], [field]: event.target.value } });
  }

  function numberField(key, label) {
    return (
      <Field label={label}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            maxLength={64}
            value={value[key].documentNumber}
            onChange={updateField(key, 'documentNumber')}
          />
        )}
      </Field>
    );
  }

  return (
    <div id="compliance" ref={sectionRef} className="mt-6 scroll-mt-4 border-t border-steel-200 pt-5">
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
        {numberField('roadTax', 'Road tax receipt number')}
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
        {numberField('nationalPermit', 'National permit number')}
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
        {numberField('insurance', 'Insurance policy number')}
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
        {numberField('statePermit', 'State permit number')}
      </Row>

      <Row title="Fitness">
        <Field label="Fitness start date">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.fitness.startDate}
              onChange={updateField('fitness', 'startDate')}
            />
          )}
        </Field>
        <Field label="Fitness end date" error={dateErrors.fitness}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="date"
              value={value.fitness.expiryDate}
              onChange={updateField('fitness', 'expiryDate')}
            />
          )}
        </Field>
        {numberField('fitness', 'Fitness certificate number')}
      </Row>
    </div>
  );
}
