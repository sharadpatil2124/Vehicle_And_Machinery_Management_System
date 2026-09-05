import { RoleBadge, Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Header({ onToggleSidebar }) {
  const { user, organization, logOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-steel-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="rounded border border-steel-200 px-2.5 py-1.5 text-steel-600 hover:bg-steel-50 lg:hidden"
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div className="min-w-0">
          <p className="truncate font-semibold text-steel-900">
            {organization?.organizationName}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-semibold text-steel-900">{user?.name}</p>
          <p className="text-xs text-steel-500">{user?.email}</p>
        </div>

        <RoleBadge role={user?.role} />

        <Button variant="secondary" size="sm" onClick={logOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
