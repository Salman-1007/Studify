import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { Flame, Clock, Target, Users, Sparkles, ListChecks } from 'lucide-react';

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

  if (isLoading) {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-400 text-sm mt-1">Here's where your studying stands right now.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Study streak" value={`${progress.streakCount} day${progress.streakCount === 1 ? '' : 's'}`} accent="text-amber-400" />
        <StatCard icon={Clock} label="Study time" value={formatMinutes(progress.totalStudyMinutes)} accent="text-blue-400" />
        <StatCard icon={Target} label="Quiz accuracy" value={`${progress.avgAccuracy}%`} accent="text-emerald-400" />
        <StatCard icon={ListChecks} label="Quizzes completed" value={progress.quizzesCompleted} accent="text-blue-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium mb-3">Weak areas</h2>
          {progress.weakTopics.length === 0 ? (
            <p className="text-sm text-slate-400">No weak topics detected yet — take a few quizzes so Studify can find patterns.</p>
          ) : (
            <ul className="space-y-2">
              {progress.weakTopics.map((t) => (
                <li key={t} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 text-sm">
                  <span>{t}</span>
                  <Link to="/quizzes/create" className="text-blue-400 text-xs">Practice</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium mb-3">Quick actions</h2>
          <div className="space-y-2">
            <Link to="/mentor" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5">
              <Sparkles size={16} className="text-blue-400" /> Ask the AI Mentor
            </Link>
            <Link to="/quizzes/create" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5">
              <ListChecks size={16} className="text-emerald-400" /> Generate a quiz
            </Link>
            <Link to="/groups" className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-2.5">
              <Users size={16} className="text-amber-400" /> Join a study group
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium mb-3">Recent quiz attempts</h2>
          {progress.recentAttempts.length === 0 ? (
            <p className="text-sm text-slate-400">No attempts yet. Your first quiz will show up here.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {progress.recentAttempts.slice(0, 5).map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span>{a.quiz.title}</span>
                  <span className="text-slate-400">{Math.round(a.percentage)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-medium mb-3">Standing</h2>
          <p className="text-sm text-slate-400">Groups joined: {progress.groupsJoined}</p>
          <p className="text-sm text-slate-400 mt-1">Flashcard decks: {progress.flashcardDecks}</p>
          {myRank && <p className="text-sm text-slate-400 mt-1">Global leaderboard rank: <span className="text-slate-100">#{myRank}</span></p>}
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
      <p className="text-2xl font-semibold mt-2" style={{ fontFamily: 'Poppins' }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
