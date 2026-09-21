import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { machineryApi, vehiclesApi } from '../api/client';
import { Alert, Badge, Input, Pagination, Select, Spinner, Table } from '../components/ui';
import useSiteNames from '../hooks/useSiteNames';

const PAGE_SIZE = 20;
const MAX_FETCH = 100;

const ASSET_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'VEHICLE', label: 'Vehicles' },
  { value: 'MACHINERY', label: 'Machinery' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function toRow(asset, assetType) {
  const isHoursBased = assetType === 'VEHICLE' ? asset.isHoursBased : true;
  return {
    ...asset,
    assetType,
    identifier:
      assetType === 'VEHICLE' ? asset.registrationNumber : (asset.registrationNumber ?? asset.serialNumber ?? '—'),
    meterLabel: isHoursBased ? 'Hrs' : 'KM',
    meterValue: isHoursBased ? asset.currentHours : asset.currentKM,
    detailPath: assetType === 'VEHICLE' ? `/vehicles/${asset.id}` : `/machinery/${asset.id}`,
  };
}

export default function AllAssetsPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    assetType: '',
    page: 1,
    sort: 'createdAt:desc',
  });
  const [rows, setRows] = useState(null);
  const siteNames = useSiteNames();
  const [error, setError] = useState(null);

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const params = {
        search: activeFilters.search || undefined,
        status: activeFilters.status || undefined,
        limit: MAX_FETCH,
        sort: 'createdAt:desc',
      };

      const wantVehicles = activeFilters.assetType === '' || activeFilters.assetType === 'VEHICLE';
      const wantMachinery = activeFilters.assetType === '' || activeFilters.assetType === 'MACHINERY';

      const [vehicleResponse, machineryResponse] = await Promise.all([
        wantVehicles ? vehiclesApi.list(params) : Promise.resolve({ data: [] }),
        wantMachinery ? machineryApi.list(params) : Promise.resolve({ data: [] }),
      ]);

      const merged = [
        ...vehicleResponse.data.map((v) => toRow(v, 'VEHICLE')),
        ...machineryResponse.data.map((m) => toRow(m, 'MACHINERY')),
      ];
      setRows(merged);
    } catch (err) {
      setError(err.message);
    }
  }, []);

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

  const sorted = rows
    ? [...rows].sort((a, b) => {
        const dir = sortDirection === 'asc' ? 1 : -1;
        const av = a[sortField];
        const bv = b[sortField];
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      })
    : null;

  const total = sorted?.length ?? 0;
  const pages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const pageRows = sorted ? sorted.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE) : [];

  const columns = [
    {
      key: 'assetType',
      label: 'Asset type',
      render: (r) => <Badge tone="neutral">{r.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}</Badge>,
    },
    { key: 'assetId', label: 'Asset ID', sortable: true },
    { key: 'identifier', label: 'Reg. / Chassis no.' },
    { key: 'type', label: 'Type' },
    {
      key: 'meterValue',
      label: 'Current meter',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span>{`${Number(r.meterValue).toLocaleString()} ${r.meterLabel}`}</span>
          {r.isServiceDue && <Badge tone="warning">Service due</Badge>}
        </div>
      ),
    },
    {
      key: 'currentSiteId',
      label: 'Site',
      render: (r) => siteNames[r.currentSiteId] ?? '—',
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Link to={r.detailPath} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">All Assets</h1>
        <p className="mt-1 text-steel-500">Every vehicle and machine in your fleet, in one list.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search asset ID, registration, serial..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)}>
          {ASSET_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!sorted ? (
          <Spinner label="Loading assets" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={pageRows}
              getRowKey={(r) => `${r.assetType}-${r.id}`}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No assets match these filters."
            />
            <Pagination
              page={filters.page}
              pages={pages}
              total={total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
