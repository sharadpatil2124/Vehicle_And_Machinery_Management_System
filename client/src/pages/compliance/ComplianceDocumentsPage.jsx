import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { complianceApi } from '../../api/client';
import { Alert, Badge, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { AssetCell, assetDetailPath } from '../../components/maintenance/MaintenanceCells';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatDateOnly } from '../../config/fuel';
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_OPTIONS,
  EXPIRY_STATUS,
  EXPIRY_WARNING_DAYS,
  NO_EXPIRY_STATUS,
  describeDaysRemaining,
} from '../../config/compliance';

const EXPIRY_FILTER_OPTIONS = [
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'EXPIRED', label: 'Critical — expired' },
  { value: 'EXPIRING_SOON', label: `Priority alert — within ${EXPIRY_WARNING_DAYS} days` },
  { value: 'VALID', label: 'Valid' },
  { value: 'NO_EXPIRY', label: 'No expiry date' },
  { value: '', label: 'All documents' },
];
const EXPIRY_FILTER_VALUES = EXPIRY_FILTER_OPTIONS.map((o) => o.value);

function SummaryTile({ label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded border bg-white px-4 py-3 text-left transition-colors hover:bg-steel-50',
        active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-steel-200',
      ].join(' ')}
    >
      <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${value ? tone : 'text-steel-900'}`}>{value}</p>
    </button>
  );
}

function StatusBadge({ status }) {
  const meta = EXPIRY_STATUS[status] ?? NO_EXPIRY_STATUS;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function DocumentCell({ doc }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-steel-900">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</span>
      {doc.docType === 'ROAD_TAX' && doc.roadTaxType && (
        <span className="text-xs text-steel-500">{doc.roadTaxType === 'OTHER' ? 'Other' : doc.roadTaxType}</span>
      )}
    </div>
  );
}

function RemainingCell({ doc }) {
  const tone =
    doc.status === 'EXPIRED' ? 'font-semibold text-danger-600' : doc.status === 'EXPIRING_SOON' ? 'font-semibold text-warning-600' : '';
  return <span className={tone}>{describeDaysRemaining(doc.daysRemaining)}</span>;
}

export default function ComplianceDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();

  const assetFilter = searchParams.get('assetId')
    ? { assetType: searchParams.get('assetType') ?? '', assetId: searchParams.get('assetId') }
    : null;
  const initialExpiry = searchParams.get('expiry');

  const [filters, setFilters] = useState({
    search: '',
    expiry: EXPIRY_FILTER_VALUES.includes(initialExpiry) ? initialExpiry : assetFilter ? '' : 'ATTENTION',
    docType: '',
    assetType: '',
    siteId: '',
    page: 1,
    sort: 'expiryDate:asc',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (active) => {
      setError(null);
      try {
        const response = await complianceApi.listAll({
          search: assetFilter ? undefined : active.search || undefined,
          expiry: active.expiry || undefined,
          docType: active.docType || undefined,
          assetType: assetFilter?.assetType || active.assetType || undefined,
          assetId: assetFilter?.assetId,
          siteId: active.siteId || undefined,
          page: active.page,
          sort: active.sort,
        });
        setResult(response);
      } catch (err) {
        setError(err.message);
      }
    },
    [assetFilter?.assetType, assetFilter?.assetId]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      const direction = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
      return { ...f, sort: `${field}:${direction}` };
    });
  }

  const [sortField, sortDirection] = filters.sort.split(':');
  const summary = result?.summary;

  const columns = [
    { key: 'asset', label: 'Asset', render: (d) => <AssetCell record={d} /> },
    { key: 'docType', label: 'Document', sortable: true, render: (d) => <DocumentCell doc={d} /> },
    { key: 'documentNumber', label: 'Number', render: (d) => d.documentNumber || '—' },
    { key: 'startDate', label: 'Start', render: (d) => formatDateOnly(d.startDate) },
    { key: 'expiryDate', label: 'Expiry', sortable: true, render: (d) => formatDateOnly(d.expiryDate) },
    { key: 'remaining', label: 'Remaining', render: (d) => <RemainingCell doc={d} /> },
    { key: 'status', label: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    { key: 'siteId', label: 'Site', render: (d) => siteNames[d.siteId] ?? '—' },
    {
      key: 'actions',
      label: '',
      render: (d) => {
        const assetPath = assetDetailPath(d.assetType, d.assetRecordId);
        return (
          <Can resource="COMPLIANCE" action="UPDATE">
            {assetPath && (
              <Link to={`${assetPath}/edit#compliance`} className="font-semibold text-brand-600 hover:underline">
                Update
              </Link>
            )}
          </Can>
        );
      },
    },
  ];

  const emptyMessage =
    filters.expiry === 'ATTENTION'
      ? `Nothing needs attention — no document is expired or expiring within ${EXPIRY_WARNING_DAYS} days.`
      : 'No compliance documents match these filters.';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Compliance Documents</h1>
        <p className="mt-1 text-steel-500">
          Road tax, permits, insurance and fitness for every active asset. Expired documents are Critical; documents expiring
          within {EXPIRY_WARNING_DAYS} days are a Priority Alert.
        </p>
      </div>

      <Alert tone="error">{error}</Alert>

      {assetFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-brand-600/25 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span>
            Showing compliance for <span className="font-semibold">{assetFilter.assetId}</span>
          </span>
          <button type="button" className="font-semibold underline" onClick={() => setSearchParams({})}>
            Show all assets
          </button>
        </div>
      )}

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Critical — expired"
            value={summary.expired}
            tone="text-danger-600"
            active={filters.expiry === 'EXPIRED'}
            onClick={() => updateFilter('expiry', 'EXPIRED')}
          />
          <SummaryTile
            label={`Priority alert — ${EXPIRY_WARNING_DAYS} days`}
            value={summary.expiringSoon}
            tone="text-warning-600"
            active={filters.expiry === 'EXPIRING_SOON'}
            onClick={() => updateFilter('expiry', 'EXPIRING_SOON')}
          />
          <SummaryTile
            label="Valid"
            value={summary.valid}
            tone="text-success-600"
            active={filters.expiry === 'VALID'}
            onClick={() => updateFilter('expiry', 'VALID')}
          />
          <SummaryTile
            label="No expiry date"
            value={summary.noExpiry}
            tone="text-steel-900"
            active={filters.expiry === 'NO_EXPIRY'}
            onClick={() => updateFilter('expiry', 'NO_EXPIRY')}
          />
        </div>
      )}

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <Input
          placeholder="Search asset, registration, RCPL or number..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          disabled={Boolean(assetFilter)}
        />
        <Select value={filters.expiry} onChange={(e) => updateFilter('expiry', e.target.value)} aria-label="Expiry">
          {EXPIRY_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={filters.docType} onChange={(e) => updateFilter('docType', e.target.value)} aria-label="Document type">
          <option value="">All document types</option>
          {DOC_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={assetFilter ? assetFilter.assetType : filters.assetType}
          onChange={(e) => updateFilter('assetType', e.target.value)}
          disabled={Boolean(assetFilter)}
          aria-label="Asset type"
        >
          <option value="">All asset types</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
        </Select>
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)} aria-label="Site">
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          error ? null : <Spinner label="Loading compliance documents" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(d) => d.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage={emptyMessage}
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
