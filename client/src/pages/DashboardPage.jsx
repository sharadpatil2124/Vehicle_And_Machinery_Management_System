import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/client';
import { Alert, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useSiteNames from '../hooks/useSiteNames';

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const FUEL_COLOR = '#1d4e78';
const PARTS_COLOR = '#8fb3d3';

function formatLitres(value) {
  return `${numberFormat.format(value)} L`;
}

function monthName(key, style = 'short') {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(style === 'long' ? 'en-IN' : 'en-US', { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) });
}

function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-steel-500 uppercase">{children}</h2>
      {aside && <span className="text-xs text-steel-500">{aside}</span>}
    </div>
  );
}

function StatTile({ label, value, detail, to, tone = 'default' }) {
  const toneClasses = tone === 'warning' ? 'border-warning-600/30 bg-warning-50' : 'border-steel-200 bg-white hover:border-brand-500';
  const valueClass = tone === 'warning' ? 'text-warning-600' : 'text-steel-900';
  const body = (
    <>
      <span className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</span>
      <span className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</span>
      {detail && <span className="mt-1 text-xs text-steel-500">{detail}</span>}
    </>
  );
  const className = `flex min-w-0 flex-col rounded border px-4 py-4 transition-colors ${toneClasses}`;
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function TrendChart({ trend, selected, onSelect }) {
  const max = Math.max(...trend.map((m) => m.total), 0);
  const pct = (value) => (max > 0 ? (value / max) * 100 : 0);

  return (
    <div className="flex gap-2 sm:gap-4">
      {trend.map((m) => {
        const isSelected = m.month === selected;
        return (
          <button
            key={m.month}
            type="button"
            onClick={() => onSelect(m.month)}
            aria-pressed={isSelected}
            aria-label={`${monthName(m.month, 'long')}: ${rupees.format(m.total)}`}
            className={`group flex min-w-0 flex-1 flex-col items-center rounded px-1 pt-1 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
              isSelected ? 'bg-brand-50' : 'hover:bg-steel-50'
            }`}
          >
            <div className="flex h-40 w-full max-w-12 flex-col justify-end border-b border-steel-200">
              <span
                className={`mb-1 text-center text-xs tabular-nums ${m.total > 0 ? (isSelected ? 'font-semibold text-steel-900' : 'text-steel-600') : 'text-steel-300'}`}
              >
                {m.total > 0 ? rupeesCompact.format(m.total) : '—'}
              </span>
              {m.parts > 0 && (
                <div
                  className={`shrink-0 rounded-t-sm transition-opacity ${isSelected ? '' : 'opacity-60 group-hover:opacity-90'}`}
                  style={{ height: `${pct(m.parts) * 0.82}%`, background: PARTS_COLOR }}
                />
              )}
              {m.fuel > 0 && (
                <div
                  className={`shrink-0 transition-opacity ${m.parts > 0 ? '' : 'rounded-t-sm'} ${isSelected ? '' : 'opacity-60 group-hover:opacity-90'}`}
                  style={{ height: `${pct(m.fuel) * 0.82}%`, background: FUEL_COLOR }}
                />
              )}
            </div>
            <span className={`mt-1.5 mb-1 text-xs ${isSelected ? 'font-semibold text-brand-700' : 'text-steel-500'}`}>{monthName(m.month)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MonthFigure({ label, value, detail }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-steel-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-steel-900 tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-steel-500">{detail}</dd>}
    </div>
  );
}

function MonthlyCard({ trend }) {
  const [selected, setSelected] = useState(trend[trend.length - 1].month);
  const month = trend.find((m) => m.month === selected) ?? trend[trend.length - 1];
  const fuelShare = month.total > 0 ? (month.fuel / month.total) * 100 : 0;

  return (
    <div className="grid gap-6 rounded border border-steel-200 bg-white p-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Fleet running cost</span>
        <span className="mt-1 text-xs text-steel-500">{monthName(month.month, 'long')} · fuel + parts used</span>
        <span className="mt-3 text-3xl font-semibold text-steel-900 tabular-nums">{rupees.format(month.total)}</span>

        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-steel-100" aria-hidden="true">
          <div style={{ width: `${fuelShare}%`, background: FUEL_COLOR }} />
          <div style={{ width: `${month.total > 0 ? 100 - fuelShare : 0}%`, background: PARTS_COLOR }} />
        </div>
        <dl className="mt-3 grid gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-steel-600">
              <span className="size-2.5 rounded-sm" style={{ background: FUEL_COLOR }} />
              Fuel
            </dt>
            <dd className="font-semibold text-steel-900 tabular-nums">{rupees.format(month.fuel)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-steel-600">
              <span className="size-2.5 rounded-sm" style={{ background: PARTS_COLOR }} />
              Parts &amp; consumables
            </dt>
            <dd className="font-semibold text-steel-900 tabular-nums">{rupees.format(month.parts)}</dd>
          </div>
        </dl>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-steel-100 pt-4 text-sm">
          <MonthFigure label="Fuel used" value={formatLitres(month.fuelLitres)} detail={`${month.fills} fills`} />
          <MonthFigure label="Parts used" value={rupees.format(month.parts)} detail={`${month.issues} issues`} />
          <MonthFigure label="Purchases received" value={rupees.format(month.purchases)} />
          <MonthFigure label="Fuel bought" value={rupees.format(month.fuelBought)} detail={formatLitres(month.fuelBoughtLitres)} />
        </dl>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide text-steel-500 uppercase">Last 6 months</span>
          <span className="text-xs text-steel-500">Click a month to see its figures</span>
        </div>
        <div className="mt-2">
          <TrendChart trend={trend} selected={month.month} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, organization, role } = useAuth();
  const siteNames = useSiteNames();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await dashboardApi.summary();
      setData(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = role === 'admin';
  const siteName = user?.siteId ? siteNames[user.siteId] : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Dashboard</h1>
          <p className="mt-1 text-steel-500">
            {organization?.organizationName}
            {!isAdmin && siteName ? ` · ${siteName}` : ''}
          </p>
        </div>
        {data && (
          <button type="button" onClick={load} className="text-xs font-semibold text-brand-600 hover:underline">
            Refresh
          </button>
        )}
      </div>

      <Alert tone="error">{error}</Alert>

      {!data && !error && <Spinner label="Loading dashboard" />}

      {data && (
        <div className="flex flex-col gap-8">
          <section>
            <SectionTitle>{isAdmin ? 'Fleet' : 'Fleet at your site'}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Vehicles" value={numberFormat.format(data.fleet.vehicles)} detail="Active" to="/vehicles" />
              <StatTile label="Machinery" value={numberFormat.format(data.fleet.machinery)} detail="Active" to="/machinery" />
              {isAdmin ? (
                <StatTile label="Sites" value={numberFormat.format(data.fleet.sites)} detail="Active" to="/sites" />
              ) : (
                <StatTile label="Your site" value={siteName ?? '—'} detail="Assigned site" to="/site-management" />
              )}
              <StatTile
                label="Service due"
                value={numberFormat.format(data.fleet.serviceDue.total)}
                detail={
                  data.fleet.serviceDue.total > 0
                    ? `${data.fleet.serviceDue.vehicles} vehicles · ${data.fleet.serviceDue.machinery} machines`
                    : 'All assets within interval'
                }
                to={data.fleet.serviceDue.vehicles > 0 || data.fleet.serviceDue.machinery === 0 ? '/vehicles' : '/machinery'}
                tone={data.fleet.serviceDue.total > 0 ? 'warning' : 'default'}
              />
            </div>
          </section>

          {isAdmin && data.monthly && (
            <section>
              <SectionTitle>Monthly running cost</SectionTitle>
              <MonthlyCard trend={data.monthly} />
            </section>
          )}

          <section>
            <SectionTitle aside="All records to date">Overall totals</SectionTitle>
            {isAdmin && data.showCosts ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile
                  label="Fuel used"
                  value={formatLitres(data.fuel.used.litres)}
                  detail={`${data.fuel.used.fills} fills · ${rupees.format(data.fuel.used.cost)}`}
                  to="/fuel/issues"
                />
                <StatTile
                  label="Parts used"
                  value={rupees.format(data.inventory.partsUsedCost)}
                  detail={`${data.inventory.issues} issues to assets`}
                  to="/inventory/movements"
                />
                <StatTile
                  label="Purchases received"
                  value={rupees.format(data.inventory.purchasesReceived)}
                  detail="Inventory, incl. tax"
                  to="/inventory/movements"
                />
                <StatTile
                  label="Fuel bought"
                  value={rupees.format(data.fuel.bought.cost)}
                  detail={formatLitres(data.fuel.bought.litres)}
                  to="/fuel/collections"
                />
                <StatTile
                  label="Stock on hand (inventory stock + diesel)"
                  value={rupees.format(data.inventory.stockValue + data.fuel.siteStock.reduce((sum, s) => sum + s.value, 0))}
                  detail={[
                    `Parts ${rupees.format(data.inventory.stockValue)}`,
                    ...data.fuel.siteStock.map((s) => `${s.fuelType} ${rupees.format(s.value)}`),
                  ].join(' · ')}
                  to="/inventory/stock"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Fuel used" value={formatLitres(data.fuel.used.litres)} detail={`${data.fuel.used.fills} fills`} to="/fuel/issues" />
                <StatTile label="Parts used" value={numberFormat.format(data.inventory.issues)} detail="Issues to assets" to="/inventory/movements" />
                <StatTile
                  label="Fuel at site"
                  value={data.fuel.siteStock.length ? data.fuel.siteStock.map((s) => formatLitres(s.litres)).join(' · ') : '0 L'}
                  detail={data.fuel.siteStock.length ? data.fuel.siteStock.map((s) => s.fuelType).join(' · ') : 'No fuel in stock'}
                  to="/fuel/stock"
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
