export default function Input({ invalid = false, describedBy, className = '', ...props }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={[
        'w-full rounded border px-3 py-2 text-sm text-steel-900',
        'placeholder:text-steel-300 focus:outline-none focus:ring-2',
        'disabled:cursor-not-allowed disabled:bg-steel-50',
        invalid
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30'
          : 'border-steel-200 focus:border-brand-600 focus:ring-brand-600/25',
        className,
      ].join(' ')}
      {...props}
    />
  );
}
