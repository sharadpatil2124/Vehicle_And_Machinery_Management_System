import { useCallback, useEffect, useState } from 'react';
import { machineryApi, vehiclesApi } from '../api/client';
import { Alert, Card, Spinner } from './ui';
import { formatCurrency } from '../config/fuel';

const PARTS = [
  { key: 'maintenance', label: 'Maintenance cost' },
  { key: 'inventory', label: 'Inventory cost' },
  { key: 'tyres', label: 'Tyre cost' },
];

export default function AssetCostCard({ assetType, asset }) {
  const [costs, setCosts] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const api = assetType === 'VEHICLE' ? vehiclesApi : machineryApi;
      setCosts((await api.costs(asset.id)).data);
    } catch (err) {
      setError(err.message);
    }
  }, [assetType, asset.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card
      title="Cost summary"
      className="mt-4"
    >
      <Alert tone="error">{error}</Alert>
      {!costs ? (
        error ? null : <Spinner label="Loading costs" />
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {PARTS.map((part) => (
              <div key={part.key} className="rounded border border-steel-200 bg-steel-50 px-4 py-3">
                <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{part.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-steel-900 tabular-nums">{formatCurrency(costs[part.key])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-baseline justify-between border-t border-steel-200 pt-3 text-sm text-steel-600">
            <span className="font-semibold">Total</span>
            <span className="text-base font-semibold text-steel-900 tabular-nums">{formatCurrency(costs.total)}</span>
          </p>
        </>
      )}
    </Card>
  );
}
