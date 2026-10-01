import { useEffect, useState } from 'react';
import { sitesApi } from '../api/client';

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
      .catch(() => setSiteNames({}));
  }, []);

  return siteNames;
}
