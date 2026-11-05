import { useState } from 'react';
import { Tabs } from '../../components/ui';
import ItemsPage from './ItemsPage';
import ItemCategoriesPage from './ItemCategoriesPage';
import UnitsOfMeasurePage from './UnitsOfMeasurePage';
import SuppliersPage from './SuppliersPage';

const TABS = [
  { value: 'items', label: 'Items', Page: ItemsPage },
  { value: 'categories', label: 'Categories', Page: ItemCategoriesPage },
  { value: 'units', label: 'Units of Measure', Page: UnitsOfMeasurePage },
  { value: 'suppliers', label: 'Suppliers', Page: SuppliersPage },
];

export default function ItemCatalogPage() {
  const [tab, setTab] = useState('items');
  const ActivePage = TABS.find((t) => t.value === tab).Page;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-steel-900">Item Catalog</h1>
        <p className="mt-1 text-steel-500">
          Everything you set up once: the items you stock, how they're grouped, and who supplies them.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <ActivePage />
    </div>
  );
}
