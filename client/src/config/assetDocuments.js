export const DOC_TYPES = ['RC', 'PUC', 'NATIONAL_PERMIT', 'INSURANCE'];

export const DOCUMENT_LABELS = {
  RC: 'RC',
  PUC: 'PUC',
  INSURANCE: 'Insurance',
  NATIONAL_PERMIT: 'National Permit',
};

export function getMandatoryDocTypes(assetType) {
  return assetType === 'VEHICLE' ? ['RC', 'PUC'] : [];
}

export function getMissingMandatoryDocTypes(assetType, files) {
  return getMandatoryDocTypes(assetType).filter((docType) => !files?.[docType]);
}

export const ACCEPTED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOCUMENT_SIZE_MB = 10;
