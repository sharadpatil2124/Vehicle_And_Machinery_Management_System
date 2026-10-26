import DashboardCard from './DashboardCard';

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const FUEL_COLOR = 'var(--color-chart-fuel)';
const PARTS_COLOR = 'var(--color-chart-parts)';
const FUEL_SELECTED_COLOR = 'var(--color-chart-fuel-selected)';
const PARTS_SELECTED_COLOR = 'var(--color-chart-parts-selected)';

function formatLitres(value) {
  return `${numberFormat.format(value)} L`;
}

export function monthName(key, style = 'short') {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  if (style === 'long') return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (style === 'month') return date.toLocaleDateString('en-IN', { month: 'long' });
  if (style === 'shortYear') return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function TrendChart({ trend, selected, onSelect }) {
  const max = Math.max(...trend.map((m) => m.fuel + m.parts), 0);
  const grow = (value) => ({ flex: `${value} 1 0px` });

  return (
    <div className="flex min-w-0 flex-1 gap-0.5 @lg:gap-1.5">
      {trend.map((m) => {
        const isSelected = m.month === selected;
        const barTone = isSelected ? '' : 'opacity-45 group-hover:opacity-70';
        return (
          <button
            key={m.month}
            type="button"
            onClick={() => onSelect(m.month)}
            aria-pressed={isSelected}
            aria-label={`${monthName(m.month, 'long')}: ${rupees.format(m.total)}`}
            title={`${monthName(m.month, 'long')} · ${rupees.format(m.total)}`}
            className={`group flex min-w-0 flex-1 flex-col rounded px-1 pt-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
              isSelected ? 'bg-brand-50' : 'hover:bg-steel-50'
            }`}
          >
            <div className="flex flex-1 flex-col">
              <div style={grow(max > 0 ? max * 1.15 - (m.fuel + m.parts) : 1)} />
              <span
                className={`mb-1 shrink-0 text-center text-[10px] whitespace-nowrap tabular-nums @lg:text-xs ${
                  m.total > 0 ? (isSelected ? 'font-semibold text-steel-900' : 'text-steel-600') : 'text-steel-300'
                }`}
              >
                {m.total > 0 ? rupeesCompact.format(m.total) : '—'}
              </span>
              {m.parts > 0 && (
                <div
                  className={`rounded-t-sm transition-opacity ${barTone}`}
                  style={{ ...grow(m.parts), background: isSelected ? PARTS_SELECTED_COLOR : PARTS_COLOR }}
                />
              )}
              {m.fuel > 0 && (
                <div
                  className={`transition-opacity ${m.parts > 0 ? '' : 'rounded-t-sm'} ${barTone}`}
                  style={{ ...grow(m.fuel), background: isSelected ? FUEL_SELECTED_COLOR : FUEL_COLOR }}
                />
              )}
            </div>
            <span className={`mt-1 mb-0.5 text-center text-xs ${isSelected ? 'font-semibold text-steel-900' : 'text-steel-500'}`}>
              {monthName(m.month)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LegendItem({ color, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      <dt className="text-steel-600">{label}</dt>
      <dd className="font-semibold text-steel-900 tabular-nums">{value}</dd>
    </div>
  );
}

export function RunningCostCard({ trend, selected, onSelect, className = '' }) {
  const month = trend.find((m) => m.month === selected) ?? trend[trend.length - 1];

  return (
    <DashboardCard title="Fleet running cost" aside="Last 6 months" className={`@container ${className}`}>
      <div className="grid flex-1 gap-x-4 gap-y-3 @sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-xs text-steel-500">{monthName(month.month, 'shortYear')} · fuel + parts</p>
          <p className="truncate text-xl font-semibold tracking-tight text-steel-900 tabular-nums">{rupees.format(month.total)}</p>
          <dl className="mt-2 grid gap-1 text-xs">
            <LegendItem color={FUEL_SELECTED_COLOR} label="Fuel" value={rupees.format(month.fuel)} />
            <LegendItem color={PARTS_SELECTED_COLOR} label="Parts" value={rupees.format(month.parts)} />
          </dl>
        </div>
        <div className="flex min-h-36 min-w-0">
          <TrendChart trend={trend} selected={month.month} onSelect={onSelect} />
        </div>
      </div>
    </DashboardCard>
  );
}

function UsageFigure({ label, value, detail }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-x-1.5 py-1 @lg:flex-col @lg:items-start @lg:py-0">
      <dt className="shrink-0 text-[13px] text-steel-600">{label}</dt>
      {detail && <dd className="min-w-0 truncate text-xs text-steel-500 @lg:order-last">{detail}</dd>}
      <dd className="ml-auto shrink-0 pl-2 text-sm font-semibold text-steel-900 tabular-nums @lg:ml-0 @lg:pl-0">{value}</dd>
    </div>
  );
}

export function UsageCard({ month, className = '' }) {
  return (
    <DashboardCard title={`${monthName(month.month, 'month')} usage`} className={`@container ${className}`}>
      <dl className="flex flex-1 flex-col divide-y divide-steel-100 @lg:grid @lg:grid-cols-4 @lg:gap-x-4 @lg:divide-y-0">
        <UsageFigure label="Fuel used" value={formatLitres(month.fuelLitres)} detail={`${month.fills} fills`} />
        <UsageFigure label="Parts used" value={rupees.format(month.parts)} detail={`${month.issues} issues`} />
        <UsageFigure label="Purchases" value={rupees.format(month.purchases)} detail="received" />
        <UsageFigure label="Fuel bought" value={rupees.format(month.fuelBought)} detail={formatLitres(month.fuelBoughtLitres)} />
      </dl>
    </DashboardCard>
  );
}
