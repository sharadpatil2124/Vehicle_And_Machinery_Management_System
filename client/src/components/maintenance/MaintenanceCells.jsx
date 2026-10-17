import { Link } from 'react-router-dom';
import { Badge } from '../ui';
import Can from '../Can';
import { MAINTENANCE_TYPE, STAGE, elapsedMinutes, formatDuration } from '../../config/maintenance';

export function assetDetailPath(assetType, assetRecordId) {
  if (!assetRecordId) return null;
  return assetType === 'VEHICLE' ? `/vehicles/${assetRecordId}` : `/machinery/${assetRecordId}`;
}

export function AssetCell({ record }) {
  const path = assetDetailPath(record.assetType, record.assetRecordId);
  const label = record.assetLabel ?? record.assetId;
  return (
    <div className="flex flex-col">
      {path ? (
        <Link to={path} className="font-semibold text-brand-600 hover:underline">
          {label}
        </Link>
      ) : (
        <span className="font-semibold text-steel-900">{label}</span>
      )}
      <span className="text-xs text-steel-500">
        {record.assetId} · {record.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
      </span>
    </div>
  );
}

export function TypeBadge({ type }) {
  const meta = MAINTENANCE_TYPE[type];
  return <Badge tone={meta?.tone}>{meta?.label ?? type}</Badge>;
}

export function StageBadge({ stage }) {
  const meta = STAGE[stage];
  return <Badge tone={meta?.tone}>{meta?.label ?? stage}</Badge>;
}

export function DowntimeCell({ record, now }) {
  if (record.type !== 'breakdown') return <span className="text-steel-400">—</span>;
  if (record.stage === 'resolved' || record.status === 'archived') {
    return <span className="tabular-nums">{formatDuration(record.downtimeMinutes)}</span>;
  }
  return (
    <span className="font-semibold text-danger-600 tabular-nums" title="Still down — counting from when it was reported">
      {formatDuration(elapsedMinutes(record.reportedAt, now))}
    </span>
  );
}

export function RowActions({ record, onAction }) {
  if (record.status === 'archived') return <Badge tone="neutral">Deleted</Badge>;

  return (
    <div className="flex items-center gap-3">
      <Can resource="MAINTENANCE" action="UPDATE">
        {record.stage === 'reported' && (
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => onAction('start', record)}>
            Start work
          </button>
        )}
        {record.stage === 'in_progress' && (
          <button type="button" className="font-semibold text-success-600 hover:underline" onClick={() => onAction('resolve', record)}>
            {record.type === 'preventive' ? 'Complete' : 'Resolve'}
          </button>
        )}
        <button type="button" className="font-semibold text-steel-600 hover:underline" onClick={() => onAction('edit', record)}>
          Edit
        </button>
      </Can>
      <Can resource="MAINTENANCE" action="DELETE">
        <button type="button" className="font-semibold text-danger-600 hover:underline" onClick={() => onAction('delete', record)}>
          Delete
        </button>
      </Can>
    </div>
  );
}
