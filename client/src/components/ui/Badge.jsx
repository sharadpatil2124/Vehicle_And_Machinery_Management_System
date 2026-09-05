const TONES = {
  neutral: 'bg-steel-100 text-steel-600',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
};

export default function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }) {
  return <Badge tone={role === 'admin' ? 'warning' : 'neutral'}>{role}</Badge>;
}
