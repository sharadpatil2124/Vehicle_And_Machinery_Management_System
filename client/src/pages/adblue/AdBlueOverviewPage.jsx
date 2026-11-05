import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adblueApi } from '../../api/client';
import { Alert, Button, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, formatLitres } from '../../config/fuel';

function Summary({ totals }) {
  const items = [
    ['Total purchased', formatLitres(totals.purchased.quantity), `Spent ${formatCurrency(totals.purchased.cost)}`],
    ['Total consumed', formatLitres(totals.consumed.quantity), 'Filled into vehicles and machinery'],
    ['Remaining stock', formatLitres(totals.remaining.quantity), `Worth ${formatCurrency(totals.remaining.value)}`],
    ['Total cost', formatCurrency(totals.totalCost), 'Cost of AdBlue consumed'],
  ];

  return (
    <dl className="mb-4 grid gap-4 rounded border border-steel-200 bg-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, detail]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
          <dd className="mt-0.5 text-xs text-steel-500 tabular-nums">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const columns = [
  { key: 'siteName', label: 'Site', render: (r) => r.siteName ?? '—' },
  { key: 'purchased', label: 'Purchased', render: (r) => <span className="tabular-nums">{formatLitres(r.purchased.quantity)}</span> },
  { key: 'consumed', label: 'Consumed', render: (r) => <span className="tabular-nums">{formatLitres(r.consumed.quantity)}</span> },
  {
    key: 'remaining',
    label: 'Remaining',
    render: (r) => <span className={`font-semibold tabular-nums ${r.remaining.quantity > 0 ? 'text-steel-900' : 'text-steel-400'}`}>{formatLitres(r.remaining.quantity)}</span>,
  },
  { key: 'averageRate', label: 'Rate / L', render: (r) => <span className="tabular-nums">{r.remaining.quantity > 0 ? formatCurrency(r.averageRate) : '—'}</span> },
  { key: 'value', label: 'Stock value', render: (r) => <span className="tabular-nums">{formatCurrency(r.remaining.value)}</span> },
  { key: 'consumedCost', label: 'Cost consumed', render: (r) => <span className="tabular-nums">{formatCurrency(r.consumed.cost)}</span> },
];

export default function AdBlueOverviewPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [siteId, setSiteId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    adblueApi
      .overview({ siteId: siteId || undefined })
      .then((r) => !cancelled && setData(r.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">AdBlue Overview</h1>
          <p className="mt-1 text-steel-500">{isAdmin ? 'AdBlue purchased, consumed and remaining at every site.' : 'AdBlue purchased, consumed and remaining at your site.'}</p>
        </div>
        <Can resource="ADBLUE" action="CREATE">
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/adblue/purchases/new" variant="secondary">
              Record purchase
            </Button>
            <Button as={Link} to="/adblue/fillings/new">
              Record filling
            </Button>
          </div>
        </Can>
      </div>

      {isAdmin && (
        <div className="mb-4 sm:max-w-xs">
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([id, name]) => (
              <option key={id} value={id} data-added={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Alert tone="error">{error}</Alert>

      {!data ? (
        !error && <Spinner label="Loading AdBlue overview" />
      ) : (
        <>
          <Summary totals={data.totals} />
          <div className="rounded border border-steel-200 bg-surface">
            <Table columns={columns} rows={data.sites} getRowKey={(r) => r.siteId} emptyMessage="No AdBlue recorded yet. Record a purchase to add stock to a site." />
          </div>
        </>
      )}
    </div>
  );
}
