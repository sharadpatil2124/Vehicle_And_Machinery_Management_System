import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitesApi } from '../../api/client';
import { Alert, Badge, Button, Card, Input, Modal, Select, Spinner } from '../../components/ui';
import SiteAssetDetailPage from './SiteAssetDetailPage';
import Can from '../../components/Can';

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'VEHICLE', label: 'Vehicles' },
  { value: 'MACHINERY', label: 'Machinery' },
];

const SITE_STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

function SiteRow({ site, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full border-b border-steel-100 px-4 py-3 text-left last:border-b-0',
        active ? 'bg-brand-50' : 'hover:bg-steel-50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-steel-900">{site.name}</span>
        <Badge tone={site.status === 'archived' ? 'neutral' : 'success'}>{site.status}</Badge>
      </div>
      <p className="mt-0.5 text-sm text-steel-500">{site.location ?? 'No location on file'}</p>
    </button>
  );
}

function SitePickerModal({ open, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (activeSearch, activeStatus) => {
    setError(null);
    try {
      const response = await sitesApi.list({ search: activeSearch || undefined, status: activeStatus || undefined, limit: 100 });
      setResults(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => load(search, status), 250);
    return () => clearTimeout(timer);
  }, [open, search, status, load]);

  useEffect(() => {
    if (open) return;
    setSearch('');
    setStatus('');
    setResults(null);
  }, [open]);

  function handleViewAll() {
    setSearch('');
    setStatus('');
  }

  return (
    <Modal open={open} onClose={onClose} title="Select a site" description="Search or filter to find the site you want to view.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search by name or location..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
          {SITE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="button"
        onClick={handleViewAll}
        disabled={!search && !status}
        className="mt-2 text-sm font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-steel-300 disabled:no-underline"
      >
        View all sites
      </button>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="mt-3 max-h-96 overflow-y-auto rounded border border-steel-200">
        {!results ? (
          <Spinner label="Loading sites" />
        ) : results.length === 0 ? (
          <p className="p-4 text-sm text-steel-400">No sites match your search.</p>
        ) : (
          results.map((site) => (
            <SiteRow key={site.id} site={site} active={false} onSelect={() => onSelect(site)} />
          ))
        )}
      </div>
    </Modal>
  );
}

function assetLabel(asset) {
  return asset.assetType === 'VEHICLE' ? asset.registrationNumber : (asset.name ?? asset.assetId);
}

function assetSearchText(asset) {
  return [asset.assetId, asset.type, asset.registrationNumber, asset.name, asset.modelNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function AssetRow({ asset, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full border-b border-steel-100 px-4 py-3 text-left last:border-b-0',
        active ? 'bg-brand-50' : 'hover:bg-steel-50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-steel-900">{assetLabel(asset)}</span>
        <Badge tone={asset.assetType === 'VEHICLE' ? 'neutral' : 'warning'}>
          {asset.assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery'}
        </Badge>
      </div>
      <p className="mt-0.5 text-sm text-steel-500">
        {asset.assetId} · {asset.type}
        {asset.isServiceDue && <span className="ml-1.5 font-medium text-warning-600">Service due</span>}
      </p>
    </button>
  );
}

export default function SiteManagementPage() {
  const [sites, setSites] = useState(null);
  const [siteId, setSiteId] = useState('');
  const [siteDetail, setSiteDetail] = useState(null);
  const [assets, setAssets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [notice, setNotice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    sitesApi
      .list({ limit: 100 })
      .then((response) => {
        setSites(response.data);
        if (response.data.length > 0) setSiteId(String(response.data[0].id));
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  const loadSite = useCallback(async (id) => {
    if (!id) return;
    setLoadError(null);
    setSelected(null);
    try {
      const [detailResponse, assetsResponse] = await Promise.all([sitesApi.get(id), sitesApi.assets(id)]);
      setSiteDetail(detailResponse.data);
      setAssets(assetsResponse.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSite(siteId);
  }, [siteId, loadSite]);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (typeFilter && asset.assetType !== typeFilter) return false;
      if (term && !assetSearchText(asset).includes(term)) return false;
      return true;
    });
  }, [assets, search, typeFilter]);

  function handleTransferred(message) {
    setNotice(message);
    loadSite(siteId);
    setTimeout(() => setNotice(null), 4000);
  }

  function handlePickSite(site) {
    setSiteId(String(site.id));
    setPickerOpen(false);
  }

  if (sites === null) return <Spinner label="Loading site management" />;

  if (sites.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-steel-900">Site Management</h1>
        <Can
          roles={['admin']}
          fallback={
            <p className="mt-2 text-steel-500">No site has been assigned to you yet. Ask your Admin to assign one.</p>
          }
        >
          <p className="mt-2 text-steel-500">
            No sites exist yet.{' '}
            <Link to="/sites" className="font-semibold text-brand-600 hover:underline">
              Create a site
            </Link>{' '}
            to start assigning vehicles and machinery.
          </p>
        </Can>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Site Management</h1>
          <p className="mt-1 text-steel-500">
            Review who's at a site, and transfer a vehicle or machine to another one.
          </p>
        </div>
        {/* Admin only: the Admin chooses which site to look at. A Supervisor has
            just one site, and the page selects it for them automatically. */}
        <Can roles={['admin']}>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            {siteDetail ? siteDetail.name : 'Select a site'}
            {siteDetail?.location ? ` — ${siteDetail.location}` : ''}
            <span aria-hidden="true">▾</span>
          </Button>
        </Can>
      </div>

      {loadError && <Alert tone="error">{loadError}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {siteDetail && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-steel-900">{siteDetail.name}</h2>
                <Badge tone={siteDetail.status === 'archived' ? 'neutral' : 'success'}>{siteDetail.status}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-steel-500">{siteDetail.location ?? 'No location on file'}</p>
            </div>
            <p className="text-sm font-medium text-steel-600">
              {assets?.length ?? 0} asset{assets?.length === 1 ? '' : 's'} currently here
            </p>
          </div>
        </Card>
      )}

      {!assets ? (
        <Spinner label="Loading assets" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="h-fit rounded border border-steel-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-steel-200 p-3 sm:flex-row">
              <Input
                placeholder="Search asset ID, type, reg. no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-40">
                {TYPE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            {filteredAssets.length === 0 ? (
              <p className="p-4 text-sm text-steel-400">
                {assets.length === 0 ? 'No assets are assigned to this site.' : 'No assets match these filters.'}
              </p>
            ) : (
              <div className="max-h-128 overflow-y-auto">
                {filteredAssets.map((asset) => (
                  <AssetRow
                    key={`${asset.assetType}-${asset.id}`}
                    asset={asset}
                    active={selected?.id === asset.id && selected?.assetType === asset.assetType}
                    onSelect={() => setSelected(asset)}
                  />
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <SiteAssetDetailPage
              key={`${selected.assetType}-${selected.id}`}
              asset={selected}
              sites={sites}
              currentSiteId={Number(siteId)}
              onTransferred={handleTransferred}
            />
          ) : (
            <Card>
              <p className="text-sm text-steel-400">Select a vehicle or machine on the left to view its details.</p>
            </Card>
          )}
        </div>
      )}

      <Can roles={['admin']}>
        <SitePickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handlePickSite} />
      </Can>
    </div>
  );
}
