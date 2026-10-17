import { useEffect, useState } from 'react';
import { sitesApi, listAll } from '../api/client';

export default function useSiteNames() {
  const [siteNames, setSiteNames] = useState({});

  useEffect(() => {
    Promise.all([listAll(sitesApi.list), listAll(sitesApi.list, { status: 'archived' })])
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
