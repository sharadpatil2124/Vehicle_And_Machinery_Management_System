import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Can from '../components/Can';

const linkClasses = ({ isActive }) =>
  [
    'block rounded px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-brand-600 font-semibold text-white'
      : 'text-steel-300 hover:bg-white/10 hover:text-white',
  ].join(' ');

function NavSection({ title, paths, children }) {
  const { pathname } = useLocation();
  const isInSection = paths.some((path) => pathname.startsWith(path));
  const [open, setOpen] = useState(isInSection);

  useEffect(() => {
    if (isInSection) setOpen(true);
  }, [isInSection]);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={[
          'flex w-full items-center justify-between rounded px-3 py-2 text-sm font-semibold transition-colors',
          isInSection ? 'text-white' : 'text-steel-200 hover:bg-white/10 hover:text-white',
        ].join(' ')}
      >
        {title}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 text-steel-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-2">{children}</div>}
    </div>
  );
}

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col overflow-y-auto bg-brand-900',
        'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <span className="text-lg font-bold tracking-[0.06em] text-white">VMMS</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5 py-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            [
              'block rounded px-3 py-2 text-sm font-semibold transition-colors',
              isActive ? 'bg-brand-600 text-white' : 'text-steel-200 hover:bg-white/10 hover:text-white',
            ].join(' ')
          }
          onClick={onNavigate}
        >
          Dashboard
        </NavLink>

        <NavSection title="Asset Management" paths={['/vehicles', '/machinery', '/sites', '/site-management']}>
          <NavLink to="/vehicles" className={linkClasses} onClick={onNavigate}>
            Vehicles
          </NavLink>
          <NavLink to="/machinery" className={linkClasses} onClick={onNavigate}>
            Machinery
          </NavLink>
          <Can roles={['admin']}>
            <NavLink to="/sites" className={linkClasses} onClick={onNavigate}>
              Sites
            </NavLink>
          </Can>
          <NavLink to="/site-management" className={linkClasses} onClick={onNavigate}>
            Site Management
          </NavLink>
        </NavSection>

        <NavSection title="Fuel" paths={['/fuel']}>
          <NavLink to="/fuel/stock" className={linkClasses} onClick={onNavigate}>
            Fuel Stock
          </NavLink>
          <NavLink to="/fuel/collections" className={linkClasses} onClick={onNavigate}>
            Fuel Collections
          </NavLink>
          <NavLink to="/fuel/issues" className={linkClasses} onClick={onNavigate}>
            Fuel Issues
          </NavLink>
          <NavLink to="/fuel/reports" className={linkClasses} onClick={onNavigate}>
            Fuel Reports
          </NavLink>
          <Can roles={['admin']}>
            <NavLink to="/fuel/stations" className={linkClasses} onClick={onNavigate}>
              Fuel Stations
            </NavLink>
          </Can>
        </NavSection>

        <NavSection title="Inventory" paths={['/inventory']}>
          <NavLink to="/inventory/catalog" className={linkClasses} onClick={onNavigate}>
            Item Catalog
          </NavLink>
          <NavLink to="/inventory/movements" className={linkClasses} onClick={onNavigate}>
            Stock Movements
          </NavLink>
          <NavLink to="/inventory/stock" className={linkClasses} onClick={onNavigate}>
            Stock
          </NavLink>
          <NavLink to="/inventory/reports" className={linkClasses} onClick={onNavigate}>
            Inventory Reports
          </NavLink>
        </NavSection>

        <Can roles={['admin']}>
          <NavSection title="Administration" paths={['/users']}>
            <NavLink to="/users" className={linkClasses} onClick={onNavigate}>
              Organization Users
            </NavLink>
          </NavSection>
        </Can>
      </nav>
    </aside>
  );
}
