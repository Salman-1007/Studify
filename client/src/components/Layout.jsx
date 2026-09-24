import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import ServerStatusBanner from './ServerStatusBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.data.notifications),
    refetchInterval: 30000,
  });
  const unread = data?.filter((n) => !n.isRead).length || 0;

  return (
    <div className="flex h-screen bg-[#0B1120] text-slate-100 relative">
      <ServerStatusBanner />
      <Sidebar isAdmin={user?.role === 'ADMIN'} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} notificationCount={unread} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
