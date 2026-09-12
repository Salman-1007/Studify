import { useQuery } from '@tanstack/react-query';
import { Trophy, Flame } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function Leaderboard() {
  const { user } = useAuth();
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/leaderboard').then((r) => r.data.data.leaderboard),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
        <Trophy className="text-amber-400" size={22} /> Global Leaderboard
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Points come from quiz completions, high scores, streak milestones, and group competitions.
      </p>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
        {leaderboard.map((entry) => (
          <div key={entry.id} className={`flex items-center justify-between px-4 py-3 text-sm ${entry.id === user.id ? 'bg-blue-500/10' : ''}`}>
            <div className="flex items-center gap-3">
              <span className="w-6 text-slate-500">#{entry.rank}</span>
              <span>{entry.name}</span>
              {entry.streakCount > 0 && <span className="flex items-center gap-0.5 text-xs text-amber-400"><Flame size={11} /> {entry.streakCount}</span>}
            </div>
            <span className="font-medium">{entry.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
