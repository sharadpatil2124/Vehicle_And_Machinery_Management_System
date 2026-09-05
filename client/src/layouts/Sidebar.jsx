import { NavLink } from 'react-router-dom';
import Can from '../components/Can';

const linkClasses = ({ isActive }) =>
  [
    'block rounded px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brand-600 font-semibold text-white'
      : 'text-steel-300 hover:bg-white/10 hover:text-white',
  ].join(' ');

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
        <NavLink to="/dashboard" className={linkClasses} onClick={onNavigate}>
          Dashboard
        </NavLink>

        <div>
          <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold tracking-[0.11em] text-steel-500 uppercase">
            Asset Management
          </p>
          <NavLink to="/vehicles" className={linkClasses} onClick={onNavigate}>
            Vehicles
          </NavLink>
          <NavLink to="/machinery" className={linkClasses} onClick={onNavigate}>
            Machinery
          </NavLink>
          <NavLink to="/assets" className={linkClasses} onClick={onNavigate}>
            All Assets
          </NavLink>
          <NavLink to="/sites" className={linkClasses} onClick={onNavigate}>
            Sites
          </NavLink>
        </div>

        <Can roles={['admin']}>
          <div>
            <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold tracking-[0.11em] text-steel-500 uppercase">
              Administration
            </p>
            <NavLink to="/users" className={linkClasses} onClick={onNavigate}>
              Organization Users
            </NavLink>
          </div>
        </Can>
      </nav>
    </aside>
  );
}
