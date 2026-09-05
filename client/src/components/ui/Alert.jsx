const TONES = {
  error: 'bg-danger-50 border-danger-500/30 text-danger-600',
  success: 'bg-success-50 border-success-600/30 text-success-600',
  warning: 'bg-warning-50 border-warning-600/30 text-warning-600',
  info: 'bg-brand-50 border-brand-600/25 text-brand-700',
};

export default function Alert({ tone = 'error', children }) {
  if (!children) return null;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-4 rounded border px-3 py-2.5 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
