import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function GroupLeaderboard() {
  const { id, groupQuizId } = useParams();
  const url = groupQuizId ? `/groups/${id}/quizzes/${groupQuizId}/leaderboard` : `/groups/${id}/leaderboard`;

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['group-leaderboard', id, groupQuizId],
    queryFn: () => api.get(url).then((r) => r.data.data.leaderboard),
    refetchInterval: 5000,
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-xl">
      <Link to={groupQuizId ? `/groups/${id}/quizzes` : `/groups/${id}`} className="text-sm text-slate-400 hover:text-slate-200">← Back</Link>
      <h1 className="text-xl font-semibold mt-2 mb-6 flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
        <Trophy className="text-amber-400" size={20} /> {groupQuizId ? 'Quiz leaderboard' : 'Group leaderboard'}
      </h1>

      {leaderboard.length === 0 ? (
        <EmptyState title="No results yet" subtitle="Scores will appear here once members submit." />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
          {leaderboard.map((entry) => (
            <div key={entry.rank} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-6 text-slate-500">#{entry.rank}</span>
                <span>{entry.user.name}</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{entry.score}</span>
                {entry.timeTakenSecs != null && <span className="text-xs text-slate-500 ml-2">{entry.timeTakenSecs}s</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
