import { Link, Navigate } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  School,
  MessageSquare,
  ArrowRight,
  GraduationCap,
  CheckCircle2,
  Sun,
  Moon,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { isApprovedTeacherUser } from '../components/ProtectedRoute.jsx';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Quiz Engine',
    desc: 'Generate curriculum-aligned MCQs from syllabus topics, textbook question banks, or uploaded lecture notes.',
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: FileText,
    title: 'Smart Notes',
    desc: 'Upload PDFs, DOCX files, or text notes for instant AI summaries, key takeaways, flashcards, and mentor Q&A.',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: School,
    title: 'Digital Classrooms',
    desc: 'Educators manage classes, share join codes, publish timed quizzes, and track real-time class analytics.',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: MessageSquare,
    title: 'Real-Time Study Chat',
    desc: 'Collaborate in classroom groups or 1-on-1 chats with replies, reactions, read receipts, and shared quizzes.',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  if (!loading && user) {
    return <Navigate to={isApprovedTeacherUser(user) ? '/teacher/dashboard' : '/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
      {/* Navigation */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5 border-b border-[var(--border-primary)]/60">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center font-bold text-white shadow-md">
            S
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Poppins' }}>
            Studify
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 text-sm">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            className="p-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {resolvedTheme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
          </button>
          <Link to="/login" className="px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium">
            Log in
          </Link>
          <Link
            to="/signup"
            className="bg-[var(--accent-primary)] hover:opacity-90 text-white px-4 py-2 rounded-xl font-medium shadow-sm transition-all"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-[var(--accent-primary)]">
            <Sparkles size={13} />
            <span>Built for Students & Educators</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight" style={{ fontFamily: 'Poppins' }}>
            One intelligent workspace for{' '}
            <span className="text-[var(--accent-primary)]">smart learning</span> &{' '}
            <span className="text-emerald-500">digital classrooms</span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Turn notes and board curricula into interactive quizzes, collaborate in real-time classroom chats,
            and empower educators with instant grading, analytics, and leaderboards.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[var(--accent-primary)] hover:opacity-90 text-white px-6 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all"
            >
              <span>Start Learning (Student)</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/signup?role=teacher"
              className="inline-flex items-center gap-2 border border-[var(--border-secondary)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] px-6 py-3.5 rounded-xl font-semibold text-sm transition-all"
            >
              <GraduationCap size={17} className="text-[var(--accent-primary)]" />
              <span>Educator Portal</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-3 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> Server-verified scoring
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> AI-grounded study tools
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> Light & Dark modes
            </span>
          </div>
        </div>

        {/* Modern Visual Showcase Card */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                  Live Classroom Preview
                </p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  BSCS — Operating Systems
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500">
                Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Students</p>
                <p className="text-lg font-bold text-[var(--text-primary)] mt-0.5">42</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Avg Score</p>
                <p className="text-lg font-bold text-emerald-500 mt-0.5">86%</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Quizzes</p>
                <p className="text-lg font-bold text-[var(--accent-primary)] mt-0.5">12</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-[var(--accent-primary)]" />
                  Midterm Prep Quiz — Published
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">15 MCQs</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--border-primary)] overflow-hidden">
                <div className="h-full w-4/5 rounded-full bg-[var(--accent-primary)]" />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                34 of 42 students completed · Auto-graded with AI explanations
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3.5 py-2.5 text-xs">
              <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                <ShieldCheck size={15} className="text-emerald-500" />
                Role-verified classroom workspace
              </span>
              <Link to="/login" className="font-semibold text-[var(--accent-primary)] hover:underline">
                Sign in →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-6 space-y-3 hover:border-[var(--accent-primary)]/50 transition-all shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${color}`}>
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-base text-[var(--text-primary)]" style={{ fontFamily: 'Poppins' }}>
                {title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
