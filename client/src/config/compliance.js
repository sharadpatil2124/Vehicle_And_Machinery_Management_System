export const ROAD_TAX_TYPE_OPTIONS = [
  { value: 'OTT', label: 'OTT' },
  { value: 'LTT', label: 'LTT' },
  { value: 'OTHER', label: 'Other' },
];

export const DOC_TYPE_OPTIONS = [
  { value: 'ROAD_TAX', label: 'Road Tax' },
  { value: 'NATIONAL_PERMIT', label: 'National Permit' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'STATE_PERMIT', label: 'State Permit' },
  { value: 'FITNESS', label: 'Fitness' },
];

export const DOC_TYPE_LABELS = Object.fromEntries(DOC_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export const EXPIRY_WARNING_DAYS = 15;

export const EXPIRY_STATUS = {
  EXPIRED: { label: 'Critical', tone: 'danger' },
  EXPIRING_SOON: { label: 'Priority alert', tone: 'warning' },
  VALID: { label: 'Valid', tone: 'success' },
};
export const NO_EXPIRY_STATUS = { label: 'No expiry', tone: 'neutral' };

export function describeDaysRemaining(days) {
  if (days === null || days === undefined) return '—';
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

function slot(document, fields) {
  return Object.fromEntries(
    [...fields, 'documentNumber'].map((field) => [field, document?.[field] ?? ''])
  );
}

export function complianceSlotsToFormValue(slots) {
  const byType = Object.fromEntries((slots ?? []).map((s) => [s.docType, s.document]));

  return {
    roadTax: slot(byType.ROAD_TAX, ['roadTaxType', 'expiryDate']),
    nationalPermit: slot(byType.NATIONAL_PERMIT, ['expiryDate']),
    insurance: slot(byType.INSURANCE, ['startDate', 'expiryDate']),
    statePermit: slot(byType.STATE_PERMIT, ['startDate', 'expiryDate']),
    fitness: slot(byType.FITNESS, ['startDate', 'expiryDate']),
  };
}
