import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/client';
import { Alert, Select, Spinner } from '../components/ui';
import { hasPermission } from '../config/permissions';
import { DocTypeTable, useComplianceDashboard } from '../components/dashboard/ComplianceOverview';
import { RunningCostCard, UsageCard } from '../components/dashboard/RunningCost';
import MaintenanceCard, { useMaintenanceSummary } from '../components/dashboard/MaintenanceCard';
import { useAuth } from '../context/AuthContext';
import useSiteNames from '../hooks/useSiteNames';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const KPI_COLUMNS = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };

function KpiCell({ label, value, detail, detailTone = 'text-steel-500', valueClass = 'text-xl sm:text-2xl', to, className = '' }) {
  const body = (
    <>
      <span className="truncate text-xs font-semibold tracking-wider text-steel-900 uppercase">{label}</span>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className={`truncate text-[13px] ${detailTone}`}>{detail}</span>
        <span className={`ml-auto max-w-full truncate font-semibold tracking-tight text-steel-900 tabular-nums ${valueClass}`}>{value}</span>
      </span>
    </>
  );
  const classes = `flex min-w-0 flex-col justify-between gap-1 bg-surface px-4 py-2 ${className}`;
  return to ? (
    <Link to={to} className={`${classes} transition-colors hover:bg-steel-50`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function CardPlaceholder({ label }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded border border-steel-200 bg-surface">
      <Spinner label={label} />
    </div>
  );
}

export default function DashboardPage() {
  const { user, role } = useAuth();
  const siteNames = useSiteNames();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [siteId, setSiteId] = useState('');
  const [siteCost, setSiteCost] = useState(null);
  const [costError, setCostError] = useState(null);
  const [siteFleet, setSiteFleet] = useState(null);
  const [fleetError, setFleetError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshKey((key) => key + 1);
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

  useEffect(() => {
    setCostError(null);
    if (!siteId) {
      setSiteCost(null);
      return undefined;
    }
    let cancelled = false;
    setSiteCost((current) => (current?.siteId === siteId ? current : null));
    dashboardApi
      .monthlyCost({ siteId })
      .then((response) => {
        if (!cancelled) setSiteCost({ siteId, monthly: response.data.monthly });
      })
      .catch((err) => {
        if (!cancelled) setCostError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, refreshKey]);

  useEffect(() => {
    setFleetError(null);
    if (!siteId) {
      setSiteFleet(null);
      return undefined;
    }
    let cancelled = false;
    setSiteFleet((current) => (current?.siteId === siteId ? current : null));
    dashboardApi
      .fleet({ siteId })
      .then((response) => {
        if (!cancelled) setSiteFleet({ siteId, fleet: response.data.fleet });
      })
      .catch((err) => {
        if (!cancelled) setFleetError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, refreshKey]);

  const isAdmin = role === 'admin';
  const showCompliance = hasPermission(role, 'COMPLIANCE', 'READ');
  const compliance = useComplianceDashboard({ enabled: showCompliance && refreshKey > 0, siteId, refreshKey });
  const showMaintenance = hasPermission(role, 'MAINTENANCE', 'READ');
  const maintenance = useMaintenanceSummary({ enabled: showMaintenance && refreshKey > 0, siteId, refreshKey });

  const siteName = user?.siteId ? siteNames[user.siteId] : null;
  const siteOptions = useMemo(
    () => Object.entries(siteNames).sort(([, a], [, b]) => a.localeCompare(b)),
    [siteNames]
  );
  const linkSiteId = isAdmin && siteId ? siteId : undefined;

  const monthly = siteId ? siteCost?.monthly : data?.monthly;
  const currentMonth = monthly?.[monthly.length - 1];
  const month = monthly ? (monthly.find((m) => m.month === selectedMonth) ?? currentMonth) : null;

  const title = isAdmin ? (siteId ? `Overview · ${siteNames[siteId] ?? 'Site'}` : 'Overview') : `Overview · ${siteName ?? 'Your site'}`;

  const fleet = siteId ? siteFleet?.fleet : data?.fleet;
  const fleetCount = (key) => (fleet ? numberFormat.format(fleet[key]) : '—');

  const kpis = data
    ? [
        { key: 'vehicles', label: 'Vehicles', value: fleetCount('vehicles'), detail: 'Active', to: '/vehicles' },
        { key: 'machinery', label: 'Machinery', value: fleetCount('machinery'), detail: 'Active', to: '/machinery' },
        isAdmin
          ? { key: 'sites', label: 'Sites', value: numberFormat.format(data.fleet.sites), detail: 'Active', to: '/sites' }
          : { key: 'site', label: 'Your site', value: siteName ?? '—', detail: 'Assigned', valueClass: 'text-lg', to: '/site-management' },
      ]
    : [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
        <h1 className="min-w-0 truncate text-xs font-semibold tracking-wider text-steel-900 uppercase">{title}</h1>
        {isAdmin && (
          <div className="w-full sm:w-56 sm:shrink-0">
            <Select searchable aria-label="Site for compliance and running cost" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {siteOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Alert tone="error">{error}</Alert>

      {!data && !error && <Spinner label="Loading dashboard" />}

      {data && (
        <>
          <section
            aria-label="Key figures"
            className={`grid grid-cols-2 gap-px overflow-hidden rounded border border-steel-200 bg-steel-200 ${KPI_COLUMNS[kpis.length] ?? ''}`}
          >
            {kpis.map(({ key, ...kpi }, index) => (
              <KpiCell key={key} {...kpi} className={kpis.length % 2 === 1 && index === kpis.length - 1 ? 'col-span-2 md:col-span-1' : ''} />
            ))}
          </section>

          <Alert tone="error">{fleetError}</Alert>

          <div
            className={`grid gap-3 ${
              showMaintenance ? 'xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1.25fr)]' : 'xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'
            }`}
          >
            {costError ? (
              <Alert tone="error">{costError}</Alert>
            ) : month ? (
              <RunningCostCard trend={monthly} selected={month.month} onSelect={setSelectedMonth} />
            ) : (
              <CardPlaceholder label="Loading site costs" />
            )}

            {month ? <UsageCard month={month} /> : !costError && <CardPlaceholder label="Loading usage" />}

            {showMaintenance &&
              (maintenance.error ? (
                <Alert tone="error">{maintenance.error}</Alert>
              ) : maintenance.data ? (
                <MaintenanceCard data={maintenance.data} />
              ) : (
                <CardPlaceholder label="Loading maintenance" />
              ))}
          </div>

          {compliance.error ? <Alert tone="error">{compliance.error}</Alert> : compliance.data && <DocTypeTable data={compliance.data} siteId={linkSiteId} />}
        </>
      )}
    </div>
  );
}
