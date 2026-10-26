import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, formatDateOnly } from '../../config/tyres';

const PAGE_SIZE = 20;

export default function TyrePurchasesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', siteId: '', status: 'active', dateFrom: '', dateTo: '', page: 1, sort: 'purchaseDate:desc' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice] = useState(location.state?.message ?? null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      const response = await tyresApi.purchases({
        search: active.search || undefined,
        siteId: active.siteId || undefined,
        status: active.status || undefined,
        dateFrom: active.dateFrom || undefined,
        dateTo: active.dateTo || undefined,
        page: active.page,
        limit: PAGE_SIZE,
        sort: active.sort,
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

  useEffect(() => {
    const last = result?.pagination?.pages;
    if (last > 0 && filters.page > last) setFilters((f) => ({ ...f, page: last }));
  }, [result, filters.page]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      return { ...f, sort: `${field}:${currentField === field && currentDirection === 'desc' ? 'asc' : 'desc'}`, page: 1 };
    });
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  const columns = [
    { key: 'purchaseNumber', label: 'Purchase', sortable: true, render: (p) => <span className="font-semibold text-steel-900">{p.purchaseNumber}</span> },
    { key: 'purchaseDate', label: 'Date', sortable: true, render: (p) => formatDateOnly(p.purchaseDate) },
    { key: 'siteName', label: 'Site', render: (p) => p.siteName ?? '—' },
    {
      key: 'supplierName',
      label: 'Supplier',
      render: (p) => (
        <div className="flex flex-col">
          <span>{p.supplierName ?? '—'}</span>
          {p.billNumber && <span className="text-xs text-steel-500">Bill {p.billNumber}</span>}
        </div>
      ),
    },
    { key: 'tyreCount', label: 'Tyres', align: 'right', render: (p) => <span className="tabular-nums">{p.tyreCount}</span> },
    { key: 'totalAmount', label: 'Total (incl. GST)', sortable: true, align: 'right', render: (p) => <span className="font-semibold tabular-nums">{formatCurrency(p.totalAmount)}</span> },
    { key: 'status', label: 'Status', render: (p) => <Badge tone={p.status === 'cancelled' ? 'neutral' : 'success'}>{p.status === 'cancelled' ? 'Cancelled' : 'Received'}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (p) => (
        <Link to={`/tyres/purchases/${p.id}`} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre Purchases</h1>
          <p className="mt-1 text-steel-500">Bulk tyre purchases. Saving a purchase adds its tyres to the site's stock.</p>
        </div>
        <Can resource="TYRE" action="CREATE">
          <Button as={Link} to="/tyres/purchases/new">
            New purchase
          </Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <Input placeholder="Search number, bill or supplier..." value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        {isAdmin && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        <Select aria-label="Status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="active">Received</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All purchases</option>
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading tyre purchases" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(p) => p.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No tyre purchases match these filters."
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              pageSize={result.pagination.limit}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              showPageNumbers
            />
          </>
        )}
      </div>
    </div>
  );
}
