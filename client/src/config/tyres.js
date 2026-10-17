const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export const REMOVAL_REASONS = [
  { value: 'WORN_OUT', label: 'Worn out' },
  { value: 'PUNCTURE', label: 'Puncture' },
  { value: 'DAMAGED', label: 'Damaged / burst' },
  { value: 'OTHER', label: 'Other' },
];

export const POSITION_SUGGESTIONS = ['Front left', 'Front right', 'Rear left', 'Rear right', 'Spare'];

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

export function meterUnit(meterType) {
  return meterType === 'HOURS' ? 'hrs' : 'KM';
}

export function formatRun(value, meterType) {
  return `${formatNumber(value ?? 0, 0)} ${meterUnit(meterType)}`;
}

export function todayDateOnly() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function tyreTypeName(type) {
  if (!type) return '';
  return `${type.label ?? [type.brand, type.pattern].filter(Boolean).join(' ')} · ${type.size}`;
}

export function assetPath(row) {
  if (!row.assetRecordId) return null;
  return row.assetType === 'VEHICLE' ? `/vehicles/${row.assetRecordId}` : `/machinery/${row.assetRecordId}`;
}
