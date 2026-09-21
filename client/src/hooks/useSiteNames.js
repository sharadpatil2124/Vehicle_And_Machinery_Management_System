import { useEffect, useState } from 'react';
import { sitesApi } from '../api/client';

/**
 * Site names keyed by site id, for lists whose rows only carry `currentSiteId`.
 *
 *   const siteNames = useSiteNames();
 *   siteNames[asset.currentSiteId]   // "D-mart", or undefined
 *
 * Archived sites are fetched as well as active ones, because a site can be
 * archived while assets are still parked at it, and those assets should still
 * show where they are. A Supervisor receives only their own site, which is the
 * only site their assets can be at.
 */
export default function useSiteNames() {
  const [siteNames, setSiteNames] = useState({});

  useEffect(() => {
    Promise.all([sitesApi.list({ limit: 100 }), sitesApi.list({ status: 'archived', limit: 100 })])
      .then(([active, archived]) => {
        const names = {};
        for (const site of [...active.data, ...archived.data]) {
          names[site.id] = site.name;
        }
        setSiteNames(names);
      })
      // A name that cannot be loaded simply shows as "—"; the list still works.
      .catch(() => setSiteNames({}));
  }, []);

  return siteNames;
}
