import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tyresApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Modal, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import TyreTypeModal from '../../components/tyres/TyreTypeModal';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency } from '../../config/tyres';

function TyreTypesDialog({ open, onClose }) {
  const [types, setTypes] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await listAll(tyresApi.types);
      setTypes(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const columns = [
    { key: 'typeCode', label: 'Code' },
    { key: 'brand', label: 'Brand / pattern', render: (t) => t.label },
    { key: 'size', label: 'Size' },
    {
      key: 'actions',
      label: '',
      render: (t) => (
        <Can resource="TYRE" action="UPDATE">
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setEditing(t)}>
            Edit
          </button>
        </Can>
      ),
    },
  ];

  return (
    <>
      <Modal open={open && editing === null} onClose={onClose} title="Tyre types" description="The brands and sizes you buy. They appear in purchase and fitting forms." wide>
        {open && (
          <div>
            <Alert tone="error">{error}</Alert>
            <div className="mb-3 flex justify-end">
              <Can resource="TYRE" action="CREATE">
                <Button size="sm" onClick={() => setEditing('new')}>
                  New tyre type
                </Button>
              </Can>
            </div>
            <div className="rounded border border-steel-200">
              {types ? <Table columns={columns} rows={types} getRowKey={(t) => t.id} emptyMessage="No tyre types yet. Add the first one." /> : <Spinner label="Loading tyre types" />}
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <TyreTypeModal
        open={editing !== null}
        tyreType={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </>
  );
}

export default function TyreStockPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', siteId: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showTypes, setShowTypes] = useState(false);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      const response = await tyresApi.stock({ search: active.search || undefined, siteId: active.siteId || undefined });
      setData(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const columns = [
    {
      key: 'type',
      label: 'Tyre type',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.tyreTypeLabel}</span>
          <span className="text-xs text-steel-500">{r.tyreSize}</span>
        </div>
      ),
    },
    { key: 'siteName', label: 'Site', render: (r) => r.siteName ?? '—' },
    {
      key: 'newQuantity',
      label: 'In stock',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold tabular-nums">{r.newQuantity}</span>
          {r.newQuantity === 0 && <Badge tone="warning">Out</Badge>}
        </span>
      ),
    },
    { key: 'usedQuantity', label: 'Returned (used)', align: 'right', render: (r) => (r.usedQuantity ? <span className="tabular-nums">{r.usedQuantity}</span> : <span className="text-steel-500">—</span>) },
    { key: 'fittedNow', label: 'Fitted now', align: 'right', render: (r) => <span className="tabular-nums">{r.fittedNow}</span> },
    { key: 'averageCost', label: 'Cost / tyre (incl. GST)', align: 'right', render: (r) => (r.newQuantity ? <span className="tabular-nums">{formatCurrency(r.averageCost)}</span> : <span className="text-steel-500">—</span>) },
    { key: 'stockValue', label: 'Stock value', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.stockValue)}</span> },
  ];

  const rows = data ? [...data.rows] : [];
  if (data && data.rows.length > 1) {
    rows.push({ id: 'total', total: true });
  }
  const totalColumns = columns.map((c) => ({
    ...c,
    render: (r) => {
      if (!r.total) return c.render ? c.render(r) : r[c.key];
      const t = data.totals;
      const cells = {
        type: <span className="font-semibold text-steel-900">Total</span>,
        newQuantity: <span className="font-semibold tabular-nums">{t.newQuantity}</span>,
        usedQuantity: <span className="tabular-nums">{t.usedQuantity || '—'}</span>,
        fittedNow: <span className="tabular-nums">{t.fittedNow}</span>,
        stockValue: <span className="font-semibold tabular-nums">{formatCurrency(t.stockValue)}</span>,
      };
      return cells[c.key] ?? '';
    },
  }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre Stock</h1>
          <p className="mt-1 text-steel-500">Tyres available at each site, ready to fit.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowTypes(true)}>
            Tyre types
          </Button>
          <Can resource="TYRE" action="CREATE">
            <Button as={Link} to="/tyres/purchases/new">
              New purchase
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:max-w-xl ${isAdmin ? 'sm:grid-cols-2' : ''}`}>
        <Input placeholder="Search brand or size..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        {isAdmin && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value }))}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!data ? (
          <Spinner label="Loading tyre stock" />
        ) : (
          <Table
            columns={totalColumns}
            rows={rows}
            getRowKey={(r) => r.id}
            emptyMessage={filters.search || filters.siteId ? 'No tyres match these filters.' : 'No tyres in stock yet. Record a purchase to add tyres.'}
          />
        )}
      </div>

      <TyreTypesDialog
        open={showTypes}
        onClose={() => {
          setShowTypes(false);
          load(filters);
        }}
      />
    </div>
  );
}
