
export default function DashboardCard({ title, aside, children, flush = false, className = '' }) {
  const inset = 'px-4';
  return (
    <section className={`flex min-w-0 flex-col rounded border border-steel-200 bg-surface py-3 ${className}`}>
      <div className={`mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${inset}`}>
        <h2 className="text-xs font-semibold tracking-wider text-steel-900 uppercase">{title}</h2>
        {aside && <div className="text-xs text-steel-500">{aside}</div>}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${flush ? '' : inset}`}>{children}</div>
    </section>
  );
}
