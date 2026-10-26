const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent',
  secondary:
    'bg-surface text-steel-700 border border-steel-200 hover:bg-steel-50 disabled:hover:bg-surface',
  danger: 'bg-danger-solid text-white hover:bg-danger-solid-hover disabled:hover:bg-danger-solid',
  ghost: 'text-steel-600 hover:bg-steel-100 hover:text-steel-900 disabled:hover:bg-transparent',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  type = 'button',
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded font-semibold',
    'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const spinner = (
    <span
      aria-hidden="true"
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );

  if (Component !== 'button') {
    return (
      <Component className={classes} aria-disabled={disabled || loading || undefined} {...props}>
        {loading && spinner}
        {children}
      </Component>
    );
  }

  return (
    <button type={type} disabled={disabled || loading} className={classes} {...props}>
      {loading && spinner}
      {children}
    </button>
  );
}
