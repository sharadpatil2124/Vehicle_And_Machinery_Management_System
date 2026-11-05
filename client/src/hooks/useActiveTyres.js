import { useEffect, useState } from 'react';
import { tyresApi } from '../api/client';

export default function useActiveTyres(assetType, assetId) {
  const [tyres, setTyres] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setTyres([]);
    if (!assetId) return undefined;
    tyresApi
      .fitments({ assetType, assetId, limit: 100 })
      .then((r) => !cancelled && setTyres(r.data.filter((f) => f.isOnAsset)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetType, assetId]);

  return tyres;
}
