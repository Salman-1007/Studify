import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { Flame, Clock, Target, Users, Sparkles, ListChecks, Zap, BookOpen, ChevronRight } from 'lucide-react';

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
  const xp = progress.xp ?? user?.xp ?? user?.points ?? 0;
  const dynamicLevel = progress.level ?? user?.level ?? 1;
  const quizzesCompleted = progress.quizzesCompleted ?? 0;
  const avgAccuracy = progress.avgAccuracy ?? 0;
  const totalStudyMinutes = progress.totalStudyMinutes ?? 0;
  const weakTopics = progress.weakTopicsDetails?.length ? progress.weakTopicsDetails : (progress.weakTopics || []);
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
            Studifying for <span className="text-slate-200 font-medium">Class {studentClass}</span> ({studentBoard}) · Level {dynamicLevel}
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

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Study streak" value={`${streak} day${streak === 1 ? '' : 's'}`} accent="text-amber-400" />
        <StatCard icon={Clock} label="Study time" value={formatMinutes(totalStudyMinutes)} accent="text-blue-400" />
        <StatCard icon={Target} label="Test accuracy" value={`${avgAccuracy}%`} accent="text-emerald-400" />
        <StatCard icon={ListChecks} label="Tests completed" value={quizzesCompleted} accent="text-blue-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weak Areas */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-200">Weak areas & focus drills</h2>
            <Link to="/question-bank" className="text-xs text-blue-400 hover:underline">Browse Bank</Link>
          </div>
          {weakTopics.length === 0 ? (
            <p className="text-sm text-slate-400">No weak topics detected yet — complete practice tests so Studify can pinpoint areas to improve.</p>
          ) : (
            <ul className="space-y-2">
              {weakTopics.slice(0, 5).map((t) => {
                const topicName = typeof t === 'string' ? t : t.topic;
                const accuracy = typeof t === 'object' ? t.accuracy : null;
                return (
                  <li key={topicName} className="flex items-center justify-between bg-slate-900 rounded-lg px-3.5 py-2.5 text-sm border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{topicName}</span>
                      {accuracy !== null && (
                        <span className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded">
                          {accuracy}% accuracy
                        </span>
                      )}
                    </div>
                    <Link to="/question-bank" className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1">
                      Practice Drill <ChevronRight size={12} />
                    </Link>
                  </li>
                );
              })}
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
          <h2 className="font-medium text-slate-200 mb-3">Recent test & quiz attempts</h2>
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-slate-400">No attempts yet. Your completed tests will appear here.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentAttempts.slice(0, 5).map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <Link to={a.url || `/quizzes/${a.id}`} className="text-slate-200 hover:text-blue-400 font-medium transition-colors">
                      {a.title || a.quiz?.title || 'Practice Test'}
                    </Link>
                    <span className="text-[11px] text-slate-500">
                      {a.type || 'Test'} · {a.date ? new Date(a.date).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      (a.percentage ?? 0) >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                      (a.percentage ?? 0) >= 50 ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {Math.round(a.percentage ?? 0)}%
                    </span>
                  </div>
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
