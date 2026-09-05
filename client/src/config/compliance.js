export const ROAD_TAX_TYPE_OPTIONS = [
  { value: 'OTT', label: 'OTT' },
  { value: 'LTT', label: 'LTT' },
  { value: 'OTHER', label: 'Other' },
];

export function complianceSlotsToFormValue(slots) {
  const byType = Object.fromEntries((slots ?? []).map((s) => [s.docType, s.document]));

  return {
    roadTax: {
      roadTaxType: byType.ROAD_TAX?.roadTaxType ?? '',
      expiryDate: byType.ROAD_TAX?.expiryDate ?? '',
    },
    nationalPermit: { expiryDate: byType.NATIONAL_PERMIT?.expiryDate ?? '' },
    insurance: {
      startDate: byType.INSURANCE?.startDate ?? '',
      expiryDate: byType.INSURANCE?.expiryDate ?? '',
    },
    statePermit: {
      startDate: byType.STATE_PERMIT?.startDate ?? '',
      expiryDate: byType.STATE_PERMIT?.expiryDate ?? '',
    },
    puc: {
      startDate: byType.PUC?.startDate ?? '',
      expiryDate: byType.PUC?.expiryDate ?? '',
    },
  };
}
