import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { BrandingProvider } from '../context/BrandingContext';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrandingProvider>
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        {sidebarOpen && (
          <div
            role="presentation"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-brand-900/50 lg:hidden"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
          <main className="flex-1 p-3 sm:p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </BrandingProvider>
  );
}
