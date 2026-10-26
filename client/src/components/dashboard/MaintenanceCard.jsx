import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/client';
import DashboardCard from './DashboardCard';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const TONES = {
  danger: { dot: 'bg-danger-500', value: 'text-danger-600' },
  warning: { dot: 'bg-warning-500', value: 'text-warning-600' },
  info: { dot: 'bg-brand-500', value: 'text-steel-900' },
  ok: { dot: 'bg-success-500', value: 'text-steel-900' },
};

function plural(count, word) {
  return `${numberFormat.format(count)} ${word}${count === 1 ? '' : 's'}`;
}

export function useMaintenanceSummary({ enabled, siteId, refreshKey }) {
  const [state, setState] = useState({ siteId: null, data: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => ({ siteId, data: current.siteId === siteId ? current.data : null, error: null }));
    dashboardApi
      .maintenance({ siteId: siteId || undefined })
      .then((response) => {
        if (!cancelled) setState({ siteId, data: response.data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ siteId, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, siteId, refreshKey]);

  return state;
}

function Tile({ label, value, detail, tone, to }) {
  const { dot, value: valueTone } = TONES[value > 0 ? tone : 'ok'];
  return (
    <Link to={to} className="flex min-w-0 flex-col rounded bg-steel-50 px-3 py-2 transition-colors hover:bg-steel-100">
      <span className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate text-xs text-steel-600">{label}</span>
      </span>
      <span className={`text-xl font-semibold tracking-tight tabular-nums ${valueTone}`}>{numberFormat.format(value)}</span>
      <span className="truncate text-xs text-steel-500">{detail}</span>
    </Link>
  );
}

export default function MaintenanceCard({ data, className = '' }) {
  const { service, open, dueSoonThreshold } = data;
  const openBreakdowns = open.breakdownReported + open.breakdownInProgress;

  return (
    <DashboardCard
      title="Maintenance"
      className={className}
      aside={
        <Link to="/maintenance/history" className="font-semibold text-brand-600 hover:underline">
          History
        </Link>
      }
    >
      <div className="grid flex-1 grid-cols-2 gap-2">
        <Tile
          label="Service overdue"
          value={service.overdue}
          detail={`${plural(service.vehicles.overdue, 'vehicle')} · ${plural(service.machinery.overdue, 'machine')}`}
          tone="danger"
          to="/maintenance/preventive"
        />
        <Tile
          label="Service due soon"
          value={service.dueSoon}
          detail={`Within ${numberFormat.format(dueSoonThreshold.KM)} km / ${dueSoonThreshold.HOURS} h`}
          tone="warning"
          to="/maintenance/preventive"
        />
        <Tile
          label="Open breakdowns"
          value={openBreakdowns}
          detail={openBreakdowns > 0 ? `${open.breakdownReported} reported · ${open.breakdownInProgress} in progress` : 'None open'}
          tone="danger"
          to="/maintenance/breakdowns"
        />
        <Tile
          label="Services in progress"
          value={open.preventive}
          detail={open.preventive > 0 ? 'Open service jobs' : 'None open'}
          tone="info"
          to="/maintenance/preventive"
        />
      </div>
    </DashboardCard>
  );
}
