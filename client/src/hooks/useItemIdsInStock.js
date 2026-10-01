import { useEffect, useState } from 'react';
import { stockApi } from '../api/client';

export default function useItemIdsInStock(siteId) {
  const [itemIds, setItemIds] = useState(() => new Set());

  useEffect(() => {
    if (!siteId) {
      setItemIds(new Set());
      return undefined;
    }
    let cancelled = false;
    stockApi
      .balances({ siteId, limit: 100 })
      .then((response) => {
        if (cancelled) return;
        const inStock = response.data.filter((balance) => balance.availableQuantity > 0);
        setItemIds(new Set(inStock.map((balance) => balance.itemId)));
      })
      .catch(() => {
        if (!cancelled) setItemIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return itemIds;
}
