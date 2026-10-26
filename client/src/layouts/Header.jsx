import { useState } from 'react';
import { RoleBadge, Button } from '../components/ui';
import Can from '../components/Can';
import BrandingDialog from '../components/BrandingDialog';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

export default function Header({ onToggleSidebar }) {
  const { user, organization, logOut } = useAuth();
  const { branding, logoUrl } = useBranding();
  const [brandingOpen, setBrandingOpen] = useState(false);

  const organizationName = organization?.organizationName;
  const title = branding?.dashboardTitle;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-steel-200 bg-surface px-4 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="rounded border border-steel-200 px-2.5 py-1.5 text-steel-600 hover:bg-steel-50 lg:hidden"
        >
          <span aria-hidden="true">☰</span>
        </button>

        {logoUrl && (
          <img src={logoUrl} alt={`${organizationName ?? 'Organization'} logo`} className="h-10 max-w-36 shrink-0 object-contain dark:rounded dark:bg-white dark:p-0.5" />
        )}

        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-bold tracking-tight text-steel-900 sm:text-xl">{organizationName}</p>
          {title && <p className="truncate text-xs font-semibold text-orange-600 md:hidden dark:text-orange-400">{title}</p>}
        </div>
      </div>
      

      <div className="hidden min-w-0 justify-center md:flex">
        {title && (
          <p
            title={title}
            className="max-w-[min(32rem,36vw)] truncate text-sm font-semibold text-orange-600 dark:text-orange-400"
          >
            {title}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 md:justify-self-end">
        <ThemeToggle />

        <Can resource="BRANDING" action="UPDATE">
          <button
            type="button"
            onClick={() => setBrandingOpen(true)}
            aria-label="Customize logo and title"
            title="Customize logo and title"
            className="rounded p-1.5 text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-900"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 3.5a2.1 2.1 0 0 1 3 3L7 16l-4 1 1-4 9.5-9.5Z" />
              <path d="m12 5 3 3" />
            </svg>
          </button>
          <BrandingDialog open={brandingOpen} onClose={() => setBrandingOpen(false)} />
        </Can>

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
