import { Menu, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ onMenuClick, notificationCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-800 bg-[#0B1120]">
      <button className="lg:hidden text-slate-300" onClick={onMenuClick}>
        <Menu size={22} />
      </button>
      <div className="hidden lg:block text-sm text-slate-400">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative text-slate-400">
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-[10px] text-black w-4 h-4 rounded-full flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="hidden sm:block text-sm text-slate-200">{user?.name}</span>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-400" title="Log out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
