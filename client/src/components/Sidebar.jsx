import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  ListChecks,
  Layers,
  Users,
  Trophy,
  LineChart,
  User,
  Settings,
  ShieldCheck,
  BookOpen,
  History,
  MessageSquare,
  Flame,
  GraduationCap,
  School,
  BarChart3,
  PlusCircle,
} from 'lucide-react';

const studentLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/classrooms', label: 'My Classrooms', icon: School },
  { to: '/daily-arena', label: 'Daily Mock Arena', icon: Flame, isHot: true },
  { to: '/question-bank', label: 'Question Bank', icon: BookOpen },
  { to: '/tests/history', label: 'Test History', icon: History },
  { to: '/mentor', label: 'AI Mentor', icon: Sparkles },
  { to: '/chat', label: 'Messages', icon: MessageSquare },
  { to: '/materials', label: 'My Materials', icon: FolderOpen },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/groups', label: 'Study Groups', icon: Users },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/progress', label: 'Progress', icon: LineChart },
];

const teacherLinks = [
  { to: '/teacher/dashboard', label: 'Teacher Dashboard', icon: GraduationCap },
  { to: '/teacher/classrooms', label: 'Classrooms', icon: School },
  { to: '/teacher/quizzes', label: 'My Assessments', icon: ListChecks },
  { to: '/teacher/quizzes/create', label: 'Quiz Builder', icon: PlusCircle },
  { to: '/teacher/analytics', label: 'Class Analytics', icon: BarChart3 },
  { to: '/chat', label: 'Messages', icon: MessageSquare },
  { to: '/materials', label: 'Materials', icon: FolderOpen },
  { to: '/teacher/settings', label: 'Educator Settings', icon: Settings },
];

const sharedFooterLinks = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isAdmin, isTeacher, teacherStatus, open, onClose }) {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-indigo-500/15 text-[var(--accent-primary)] font-medium'
        : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-64 bg-[var(--bg-surface)] border-r border-[var(--border-primary)] z-40 transform transition-transform
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="px-6 py-5 flex items-center gap-2.5 border-b border-[var(--border-primary)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center font-bold text-white shadow-sm">
            S
          </div>
          <span className="font-semibold text-lg text-[var(--text-primary)]" style={{ fontFamily: 'Poppins' }}>
            Studify
          </span>
          {isTeacher && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Educator
            </span>
          )}
        </div>

        <nav className="px-3 py-4 flex flex-col gap-1 overflow-y-auto h-[calc(100%-73px)]">
          {teacherStatus === 'PENDING' && !isTeacher && (
            <div className="mx-1 mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-500 leading-snug">
              Educator account pending verification. Student tools remain active.
            </div>
          )}

          {isTeacher ? (
            <>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 py-1">
                Educator Portal
              </span>
              {teacherLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={onClose} end={to === '/teacher/quizzes'} className={linkClass}>
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                </NavLink>
              ))}

              <div className="mt-3 pt-3 border-t border-[var(--border-primary)] flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 py-1">
                  Learning Tools
                </span>
                <NavLink to="/question-bank" onClick={onClose} className={linkClass}>
                  <BookOpen size={18} />
                  <span>Question Bank</span>
                </NavLink>
                <NavLink to="/mentor" onClick={onClose} className={linkClass}>
                  <Sparkles size={18} />
                  <span>AI Mentor</span>
                </NavLink>
                <NavLink to="/groups" onClick={onClose} className={linkClass}>
                  <Users size={18} />
                  <span>Study Groups</span>
                </NavLink>
                <NavLink to="/profile" onClick={onClose} className={linkClass}>
                  <User size={18} />
                  <span>Profile</span>
                </NavLink>
              </div>
            </>
          ) : (
            <>
              {studentLinks.map(({ to, label, icon: Icon, isHot }, i) => (
                <NavLink key={label + i} to={to} onClick={onClose} className={linkClass}>
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {isHot && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Daily
                    </span>
                  )}
                </NavLink>
              ))}
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)] flex flex-col gap-1">
                {sharedFooterLinks.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}

          {isAdmin && (
            <div className="mt-3 border-t border-[var(--border-primary)] pt-3 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 py-1">
                Admin
              </span>
              <NavLink
                to="/admin"
                end
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-500 font-medium'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
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
                    isActive
                      ? 'bg-amber-500/15 text-amber-500 font-medium'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
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
