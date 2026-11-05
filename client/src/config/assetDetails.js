import { machineryLabel } from './fuel';

const isVehicle = (assetType) => assetType === 'VEHICLE';

export function assetTypeLabel(assetType) {
  return isVehicle(assetType) ? 'Vehicle' : 'Machinery';
}

// The name people know the asset by: Registration Number for a vehicle, RCPL (and name) for a machine.
export function assetIdentity(assetType, asset) {
  if (isVehicle(assetType)) return asset?.registrationNumber ?? null;
  if (!asset?.rcpl && !asset?.name) return null;
  return machineryLabel(asset);
}

// What an Asset column shows: Registration Number for a vehicle, RCPL for a machine.
export function assetNumber(assetType, assetId, asset) {
  return (isVehicle(assetType) ? asset?.registrationNumber : asset?.rcpl) ?? assetId;
}

// The rest of the asset, for a list that has the number in its own column: "Machinery · JCB Backhoe Loader · MCH-000023".
export function assetDescription(assetType, assetId, asset) {
  const parts = [assetTypeLabel(assetType)];
  if (!isVehicle(assetType) && asset?.name) parts.push(asset.name);
  parts.push(assetId);
  return parts.join(' · ');
}

function currentReading(assetType, asset) {
  const number = (value) => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const usesHours = !isVehicle(assetType) || asset.isHoursBased;
  const value = usesHours ? asset.currentHours : asset.currentKM;
  if (value == null) return null;
  return `${number(value)} ${usesHours ? 'hours' : 'KM'}`;
}

// Every detail worth showing about the asset. Fields a viewer may not see (see the server) are simply absent.
export function assetDetailFields(assetType, asset, { siteNames = {} } = {}) {
  if (!asset) return [];
  const identity = isVehicle(assetType)
    ? [
        { label: 'Registration Number', value: asset.registrationNumber },
        { label: 'Asset code', value: asset.assetId },
        { label: 'Type', value: asset.type },
        { label: 'Model number', value: asset.modelNumber },
        { label: 'Chassis number', value: asset.chassisNumber },
      ]
    : [
        { label: 'RCPL', value: asset.rcpl },
        { label: 'Machine name', value: asset.name },
        { label: 'Asset code', value: asset.assetId },
        { label: 'Type', value: asset.type },
        { label: 'Model number', value: asset.modelNumber },
        { label: 'Serial number', value: asset.serialNumber },
      ];

  const fields = [
    ...identity,
    { label: 'Year', value: asset.year },
    { label: 'Fuel type', value: asset.fuelType },
    { label: 'Status', value: asset.status ? asset.status.charAt(0).toUpperCase() + asset.status.slice(1) : null },
  ];

  if (asset.currentHours !== undefined || asset.currentKM !== undefined) {
    fields.push({ label: 'Current reading', value: currentReading(assetType, asset) });
  }
  if (asset.currentSiteId !== undefined) {
    fields.push({ label: 'Current site', value: asset.currentSiteId == null ? 'Unassigned' : siteNames[asset.currentSiteId] });
  }
  return fields;
}

export function assetRecordPath(assetType, asset) {
  if (!asset?.id) return null;
  return isVehicle(assetType) ? `/vehicles/${asset.id}` : `/machinery/${asset.id}`;
}
