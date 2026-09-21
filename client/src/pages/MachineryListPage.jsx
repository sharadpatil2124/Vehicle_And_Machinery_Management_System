import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { machineryApi } from '../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../components/ui';
import Can from '../components/Can';
import useSiteNames from '../hooks/useSiteNames';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function ServiceDueBadge({ machine }) {
  if (!machine.isServiceDue) return null;
  return <Badge tone="warning">Service due</Badge>;
}

export default function MachineryListPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    fuelType: '',
    page: 1,
    sort: 'createdAt:desc',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const siteNames = useSiteNames();

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await machineryApi.list({
        search: activeFilters.search || undefined,
        status: activeFilters.status || undefined,
        fuelType: activeFilters.fuelType || undefined,
        page: activeFilters.page,
        sort: activeFilters.sort,
      });
      setResult(response);
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

  const columns = [
    { key: 'assetId', label: 'Asset ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true, render: (m) => m.name ?? '—' },
    {
      key: 'registrationNumber',
      label: 'Registration',
      sortable: true,
      render: (m) => m.registrationNumber ?? '—',
    },
    { key: 'serialNumber', label: 'Chassis number', render: (m) => m.serialNumber ?? '—' },
    { key: 'type', label: 'Type' },
    {
      key: 'currentHours',
      label: 'Current hours',
      sortable: true,
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <span>{Number(m.currentHours).toLocaleString()}</span>
          <ServiceDueBadge machine={m} />
        </div>
      ),
    },
    {
      key: 'currentSiteId',
      label: 'Site',
      render: (m) => siteNames[m.currentSiteId] ?? '—',
    },
    {
      key: 'actions',
      label: '',
      render: (m) => (
        <Link to={`/machinery/${m.id}`} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Machinery</h1>
          <p className="mt-1 text-steel-500">Hours-based assets in your fleet.</p>
        </div>
        <Can resource="MACHINERY" action="CREATE">
          <Button as={Link} to="/machinery/new">
            Add machine
          </Button>
        </Can>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search asset ID, name, registration, model, chassis..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Filter by fuel type"
          value={filters.fuelType}
          onChange={(e) => updateFilter('fuelType', e.target.value)}
        />
      </div>

      <div className="rounded border border-steel-200 bg-white">
        {!result ? (
          <Spinner label="Loading machinery" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(m) => m.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No machinery matches these filters."
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
