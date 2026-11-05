import { useEffect } from 'react';

// After the only row on the last page is archived, that page no longer exists: go back to the one that is last now.
export default function useLastValidPage(result, page, setFilters) {
  const last = result?.pagination?.pages;

  useEffect(() => {
    if (last > 0 && page > last) setFilters((f) => ({ ...f, page: last }));
  }, [last, page, setFilters]);
}
