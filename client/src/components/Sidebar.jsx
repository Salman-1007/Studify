import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Sparkles, FolderOpen, ListChecks, Layers,
  Users, Compass, Trophy, LineChart, User, Settings, ShieldCheck,
  BookOpen, History, MessageSquare,
} from 'lucide-react';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/question-bank', label: 'Question Bank', icon: BookOpen },
  { to: '/tests/history', label: 'Test History', icon: History },
  { to: '/mentor', label: 'AI Mentor', icon: Sparkles },
  { to: '/chat', label: '1-on-1 Chat', icon: MessageSquare },
  { to: '/materials', label: 'My Materials', icon: FolderOpen },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/groups', label: 'Study Groups', icon: Users },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isAdmin, open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-64 bg-[#0A0F1E] border-r border-slate-800 z-40 transform transition-transform
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="px-6 py-5 flex items-center gap-2 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white">S</div>
          <span className="font-semibold text-lg text-white" style={{ fontFamily: 'Poppins' }}>Studify</span>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1 overflow-y-auto h-[calc(100%-72px)]">
          {links.map(({ to, label, icon: Icon }, i) => (
            <NavLink
              key={label + i}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <div className="mt-2 border-t border-slate-800 pt-3 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1">Admin</span>
              <NavLink
                to="/admin"
                end
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <ShieldCheck size={18} />
                Overview
              </NavLink>
              <NavLink
                to="/admin/questions"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <BookOpen size={18} />
                Question Bank
              </NavLink>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
