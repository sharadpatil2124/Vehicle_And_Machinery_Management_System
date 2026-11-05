import { assetDetailFields } from '../config/assetDetails';

export default function AssetDetailsList({ assetType, asset, siteNames }) {
  const fields = assetDetailFields(assetType, asset, { siteNames });
  if (fields.length === 0) return null;

  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{field.label}</dt>
          <dd className="mt-1 text-steel-900">{field.value ?? <span className="text-steel-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
