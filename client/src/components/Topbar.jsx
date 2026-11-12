import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  LogOut,
  ShieldCheck,
  CheckCheck,
  Sparkles,
  Trophy,
  MessageSquare,
  Award,
  Clock,
  Sun,
  Moon,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { isApprovedTeacherUser } from './ProtectedRoute.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.data.notifications || []),
    refetchInterval: 15000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.link) {
      setDropdownOpen(false);
      navigate(n.link);
    }
  };

  const getNotifIcon = (title = '', type = '') => {
    const t = (title + ' ' + type).toLowerCase();
    if (t.includes('trophy') || t.includes('winner') || t.includes('quiz')) return <Trophy size={16} className="text-amber-400" />;
    if (t.includes('message') || t.includes('chat') || t.includes('group')) return <MessageSquare size={16} className="text-blue-400" />;
    if (t.includes('streak') || t.includes('xp') || t.includes('level')) return <Sparkles size={16} className="text-emerald-400" />;
    if (t.includes('classroom') || t.includes('announcement') || t.includes('teacher')) return <GraduationCap size={16} className="text-indigo-400" />;
    return <Award size={16} className="text-indigo-400" />;
  };

  const isTeacher = isApprovedTeacherUser(user);

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--border-primary)] bg-[var(--bg-surface)] relative z-40 transition-colors">
      <button
        type="button"
        aria-label="Open navigation menu"
        className="lg:hidden text-[var(--text-secondary)] p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
        onClick={onMenuClick}
      >
        <Menu size={22} />
      </button>

      <div className="hidden lg:block text-sm text-[var(--text-muted)]">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {isTeacher && user?.role !== 'ADMIN' && (
          <Link
            to="/teacher/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/25 transition-all"
          >
            <GraduationCap size={14} />
            <span>Educator Portal</span>
          </Link>
        )}

        {user?.role === 'ADMIN' && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold hover:bg-rose-500/25 transition-all"
          >
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Admin Panel</span>
          </Link>
        )}

        {/* Quick Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          {resolvedTheme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-indigo-600" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="relative p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell size={20} className={unreadCount > 0 ? 'text-amber-400' : ''} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-amber-500 text-[10px] font-bold text-slate-950 min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-2xl py-3 z-50 text-[var(--text-primary)]">
              <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="text-xs text-[var(--accent-blue)] hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-primary)]">
                {notifications.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <Bell size={28} className="mx-auto text-[var(--text-muted)] mb-2 opacity-60" />
                    <p className="text-xs text-[var(--text-secondary)]">No notifications yet</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Take a quiz or join a classroom to get updates!</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 hover:bg-[var(--bg-secondary)] transition-colors flex items-start gap-3 cursor-pointer ${
                        !n.isRead ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] shrink-0 mt-0.5">
                        {getNotifIcon(n.title, n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className={`text-xs truncate ${!n.isRead ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
                            {n.title || 'Notification'}
                          </h5>
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                            <Clock size={10} />
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                          {n.message || n.content}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shrink-0 mt-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-sm font-medium">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="hidden sm:block text-sm text-[var(--text-primary)] font-medium">{user?.name}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className="text-[var(--text-muted)] hover:text-red-500 p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          title="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
