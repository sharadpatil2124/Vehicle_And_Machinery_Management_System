import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { complianceApi } from '../../api/client';
import { DOC_TYPE_LABELS } from '../../config/compliance';
import DashboardCard from './DashboardCard';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function statusesFor(warningDays) {
  return [
    { key: 'expired', expiry: 'EXPIRED', label: 'Expired', detail: 'Critical', swatch: 'bg-danger-500', text: 'text-danger-600' },
    {
      key: 'expiringSoon',
      expiry: 'EXPIRING_SOON',
      label: `Due within ${warningDays} days`,
      detail: 'Priority',
      swatch: 'bg-warning-500',
      text: 'text-warning-600',
    },
    { key: 'valid', expiry: 'VALID', label: 'Valid', swatch: 'bg-success-500', text: 'text-success-600' },
    { key: 'noExpiry', expiry: 'NO_EXPIRY', label: 'No expiry date', swatch: 'bg-steel-300', text: 'text-steel-600' },
  ];
}

export function complianceLink(params) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null));
  return `/compliance?${search}`;
}

export function useComplianceDashboard({ enabled, siteId, refreshKey }) {
  const [state, setState] = useState({ siteId: null, data: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((current) => ({ siteId, data: current.siteId === siteId ? current.data : null, error: null }));
    complianceApi
      .dashboard({ siteId: siteId || undefined })
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

function StatusBar({ counts, statuses }) {
  if (!counts.total) return <div className="h-2 rounded-full bg-steel-100" aria-hidden="true" />;
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
      {statuses.map(
        (s) =>
          counts[s.key] > 0 && (
            <div
              key={s.key}
              className={`${s.swatch} min-w-1`}
              style={{ width: `${(counts[s.key] / counts.total) * 100}%` }}
              title={`${s.label}: ${counts[s.key]}`}
            />
          )
      )}
    </div>
  );
}

function CheckIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IssueCounts({ counts }) {
  if (!counts.total) return <span className="text-steel-300">—</span>;
  if (!counts.expired && !counts.expiringSoon) {
    return (
      <span className="inline-flex items-center gap-1 text-success-600">
        <CheckIcon className="size-3.5" /> In order
      </span>
    );
  }
  return (
    <span className="inline-flex gap-x-1.5 whitespace-nowrap">
      {counts.expired > 0 && <span className="text-danger-600">{numberFormat.format(counts.expired)} expired</span>}
      {counts.expiringSoon > 0 && <span className="text-warning-600">{numberFormat.format(counts.expiringSoon)} due</span>}
    </span>
  );
}

function CountCell({ value, tone, className = '' }) {
  return <td className={`px-3 py-1 tabular-nums ${tone} ${className}`}>{value > 0 ? numberFormat.format(value) : '–'}</td>;
}

const TH = 'px-3 py-1.5 font-semibold whitespace-nowrap';

export function DocTypeTable({ data, siteId, className = '' }) {
  const navigate = useNavigate();
  const statuses = useMemo(() => statusesFor(data.warningDays ?? 15), [data.warningDays]);

  return (
    <DashboardCard flush title="By document type" aside="Click a row to open documents" className={`@container ${className}`}>
      <table className="w-full text-left text-[13px]">
        <thead className="border-y border-steel-200 bg-steel-50 text-xs font-semibold tracking-wider text-steel-900 uppercase">
          <tr>
            <th scope="col" className={`${TH} pl-4`}>Document</th>
            <th scope="col" className={TH}>Total</th>
            <th scope="col" className={`${TH} hidden w-full @2xl:table-cell`}>Status split</th>
            <th scope="col" className={`${TH} hidden @lg:table-cell`}>Valid</th>
            <th scope="col" className={`${TH} hidden @lg:table-cell`}>Due</th>
            <th scope="col" className={`${TH} hidden @lg:table-cell`}>Expired</th>
            <th scope="col" className={`${TH} hidden @lg:table-cell`}>No expiry</th>
            <th scope="col" className={`${TH} pr-4`}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-steel-100">
          {data.byDocType.map((row) => {
            const to = complianceLink({ docType: row.docType, expiry: row.expired + row.expiringSoon > 0 ? 'ATTENTION' : '', siteId });
            return (
              <tr
                key={row.docType}
                onClick={(e) => {
                  if (!e.target.closest('a')) navigate(to);
                }}
                className="cursor-pointer transition-colors hover:bg-steel-50"
              >
                <td className="py-1 pr-3 pl-4 font-semibold whitespace-nowrap text-steel-900">
                  <Link to={to} className="hover:text-brand-600">
                    {DOC_TYPE_LABELS[row.docType] ?? row.docType}
                  </Link>
                </td>
                <td className="px-3 py-1 text-steel-700 tabular-nums">{numberFormat.format(row.total)}</td>
                <td className="hidden px-3 py-1 @2xl:table-cell">
                  <div className="min-w-24">
                    <StatusBar counts={row} statuses={statuses} />
                  </div>
                </td>
                <CountCell value={row.valid} tone="text-success-600" className="hidden @lg:table-cell" />
                <CountCell value={row.expiringSoon} tone="text-warning-600" className="hidden @lg:table-cell" />
                <CountCell value={row.expired} tone="text-danger-600" className="hidden @lg:table-cell" />
                <CountCell value={row.noExpiry} tone="text-steel-500" className="hidden @lg:table-cell" />
                <td className="py-1 pr-4 pl-3 whitespace-nowrap">
                  <IssueCounts counts={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DashboardCard>
  );
}
