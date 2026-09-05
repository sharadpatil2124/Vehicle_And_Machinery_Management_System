export default function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={`rounded border border-steel-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-steel-200 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-steel-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-steel-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
