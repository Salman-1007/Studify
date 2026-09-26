import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { Flame, Clock, Target, Users, Sparkles, ListChecks, Zap, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get('/progress').then((r) => r.data.data),
  });
  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/leaderboard').then((r) => r.data.data.leaderboard),
  });

  const myRank = leaderboard?.find((l) => l.id === user?.id)?.rank;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (isLoading || !progress) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const streak = progress.streakCount ?? user?.streak ?? user?.streakCount ?? 0;
  const xp = user?.xp ?? user?.points ?? 0;
  const quizzesCompleted = progress.quizzesCompleted ?? 0;
  const avgAccuracy = progress.avgAccuracy ?? 0;
  const totalStudyMinutes = progress.totalStudyMinutes ?? 0;
  const weakTopics = progress.weakTopics || [];
  const recentAttempts = progress.recentAttempts || [];
  const studentClass = user?.class || user?.grade || '9';
  const studentBoard = user?.board || 'Punjab Board';

  return (
    <div className="space-y-8">
      {/* Welcome & Academic Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white" style={{ fontFamily: 'Poppins' }}>
            {greeting}, {user?.name?.split(' ')[0] || 'Student'} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Studifying for <span className="text-slate-200 font-medium">Class {studentClass}</span> ({studentBoard}) · Level {user?.level || 1}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <Zap size={14} className="text-amber-400" />
            <span className="font-semibold text-slate-100">{xp}</span>
            <span className="text-slate-400">XP</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <Flame size={14} className="text-orange-400" />
            <span className="font-semibold text-slate-100">{streak}</span>
            <span className="text-slate-400">Streak</span>
          </div>
        </div>
      </div>

      {/* Daily Mock Arena Spotlight Card */}
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-950/40 via-slate-900 to-blue-950/40 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-orange-500/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-orange-500/20">
            <Flame size={24} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-400 mb-1">
              <Zap size={13} /> Daily Challenge Live · +50 Bonus XP
            </div>
            <h3 className="text-lg font-bold text-white">Daily Mock Exam Challenge</h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
              Synchronized daily questions across Class 9–12, MDCAT & ECAT. Maintain your {streak}-day study streak!
            </p>
          </div>
        </div>
        <Link
          to="/daily-arena"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-all shadow-md shadow-orange-500/20 self-start md:self-auto shrink-0"
        >
          <Play size={15} fill="currentColor" /> Enter Daily Arena
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Study streak" value={`${streak} day${streak === 1 ? '' : 's'}`} accent="text-amber-400" />
        <StatCard icon={Clock} label="Study time" value={formatMinutes(totalStudyMinutes)} accent="text-blue-400" />
        <StatCard icon={Target} label="Quiz accuracy" value={`${avgAccuracy}%`} accent="text-emerald-400" />
        <StatCard icon={ListChecks} label="Quizzes completed" value={quizzesCompleted} accent="text-blue-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weak Areas */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium text-slate-200 mb-3">Weak areas</h2>
          {weakTopics.length === 0 ? (
            <p className="text-sm text-slate-400">No weak topics detected yet — take quizzes so Studify can pinpoint areas to improve.</p>
          ) : (
            <ul className="space-y-2">
              {weakTopics.map((t) => (
                <li key={t} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 text-sm">
                  <span>{t}</span>
                  <Link to="/quizzes/create" className="text-blue-400 text-xs hover:underline">Practice</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium text-slate-200 mb-3">Quick actions</h2>
          <div className="space-y-2">
            <Link to="/question-bank" className="flex items-center gap-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded-lg px-3 py-2.5 transition-colors font-medium">
              <BookOpen size={16} className="text-blue-400" /> Practice Board Question Bank
            </Link>
            <Link to="/mentor" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5 transition-colors">
              <Sparkles size={16} className="text-blue-400" /> Ask the AI Mentor
            </Link>
            <Link to="/quizzes/create" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5 transition-colors">
              <ListChecks size={16} className="text-emerald-400" /> Generate a quiz
            </Link>
            <Link to="/groups" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5 transition-colors">
              <Users size={16} className="text-amber-400" /> Join a study group
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Attempts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium text-slate-200 mb-3">Recent quiz attempts</h2>
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-slate-400">No attempts yet. Your completed tests will appear here.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentAttempts.slice(0, 5).map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span>{a.quiz?.title || 'Quiz'}</span>
                  <span className="text-slate-400">{Math.round(a.percentage)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Academic Standing */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium text-slate-200 mb-3">Academic Standing</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <p>Class & Board: <span className="text-slate-200 font-medium">Class {studentClass} · {studentBoard}</span></p>
            <p>Study Groups joined: <span className="text-slate-200 font-medium">{progress.groupsJoined ?? 0}</span></p>
            <p>Flashcard decks: <span className="text-slate-200 font-medium">{progress.flashcardDecks ?? 0}</span></p>
            <p>Global leaderboard rank: <span className="text-slate-200 font-medium">{myRank ? `#${myRank}` : 'Unranked'}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

const formatMinutes = (m) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <Icon size={18} className={accent} />
      <p className="text-2xl font-semibold mt-2 text-white" style={{ fontFamily: 'Poppins' }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
