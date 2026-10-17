export const MAINTENANCE_TYPE = {
  preventive: { label: 'Preventive', tone: 'brand' },
  breakdown: { label: 'Breakdown', tone: 'danger' },
};

export const STAGE = {
  reported: { label: 'Reported', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'brand' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export const SCHEDULE_STATE = {
  overdue: { label: 'Overdue', tone: 'danger' },
  due_soon: { label: 'Due soon', tone: 'warning' },
  ok: { label: 'On schedule', tone: 'success' },
};

const MS_PER_MINUTE = 60 * 1000;

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function elapsedMinutes(from, now = new Date()) {
  return Math.max(0, Math.floor((now - new Date(from)) / MS_PER_MINUTE));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value) {
  return new Date(value).toISOString();
}

export function isInFuture(dateTimeLocal) {
  return new Date(dateTimeLocal).getTime() > Date.now() + MS_PER_MINUTE;
}
