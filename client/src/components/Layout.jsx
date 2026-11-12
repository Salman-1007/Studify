import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import ServerStatusBanner from './ServerStatusBanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isApprovedTeacherUser } from './ProtectedRoute.jsx';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative transition-colors">
      <ServerStatusBanner />
      <Sidebar
        isAdmin={user?.role === 'ADMIN'}
        isTeacher={isApprovedTeacherUser(user)}
        teacherStatus={user?.teacherStatus}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
