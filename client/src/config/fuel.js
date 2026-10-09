const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export const STORABLE_FUEL_TYPES = ['Diesel', 'Petrol'];

export const COLLECTION_STATUS = {
  in_transit: { label: 'In transit', tone: 'warning' },
  received: { label: 'Received', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const SOURCE_LABEL = {
  SITE_STOCK: 'Site stock',
  DIRECT_PUMP: 'Direct at pump',
};

export const ENTRY_TYPE = {
  RECEIPT: { label: 'Received', tone: 'success' },
  ISSUE: { label: 'Issued', tone: 'warning' },
  ISSUE_REVERSAL: { label: 'Issue deleted', tone: 'brand' },
};

function isBlank(value) {
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value));
}

export function formatCurrency(value) {
  if (isBlank(value)) return '—';
  return currencyFormatter.format(Number(value));
}

export function formatNumber(value, maximumFractionDigits = 2) {
  if (isBlank(value)) return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits });
}

export function formatLitres(value) {
  if (isBlank(value)) return '—';
  return `${formatNumber(value, 3)} L`;
}

export function meterUnitLabel(meterType) {
  return meterType === 'HOURS' ? 'hrs' : 'KM';
}

export function meterTypeForAsset(assetType, asset) {
  if (assetType === 'MACHINERY') return 'HOURS';
  return asset?.isHoursBased ? 'HOURS' : 'KM';
}

export function todayDateOnly() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function firstOfMonthDateOnly() {
  return `${todayDateOnly().slice(0, 8)}01`;
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function assetDisplayName(assetType, asset) {
  if (!asset) return '';
  if (assetType === 'VEHICLE') return asset.registrationNumber;
  return asset.name || asset.registrationNumber || asset.serialNumber || asset.assetId;
}
