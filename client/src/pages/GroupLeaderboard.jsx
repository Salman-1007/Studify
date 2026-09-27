import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Award, MessageSquare, ArrowLeft, Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function GroupLeaderboard() {
  const { id, groupQuizId } = useParams();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [sharing, setSharing] = useState(false);

  const url = groupQuizId ? `/groups/${id}/quizzes/${groupQuizId}/leaderboard` : `/groups/${id}/leaderboard`;

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['group-leaderboard', id, groupQuizId],
    queryFn: () => api.get(url).then((r) => r.data.data.leaderboard),
    refetchInterval: 5000,
  });

  const announceToChat = async () => {
    if (!groupQuizId) return;
    setSharing(true);
    try {
      await api.post(`/groups/${id}/quizzes/${groupQuizId}/end`);
      showToast('Podium results announced to the group chat! 🏆', 'success');
      qc.invalidateQueries({ queryKey: ['group-leaderboard', id, groupQuizId] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not announce to chat', 'error');
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  const p1 = leaderboard[0];
  const p2 = leaderboard[1];
  const p3 = leaderboard[2];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to={groupQuizId ? `/groups/${id}/quizzes` : `/groups/${id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Back to {groupQuizId ? 'Group Quizzes' : 'Group'}
        </Link>
        <Link
          to={`/groups/${id}/chat`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
        >
          <MessageSquare size={13} /> Group Chat
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
            <Trophy className="text-amber-400" size={24} /> {groupQuizId ? 'Quiz Competition Standings' : 'Group Leaderboard'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time score rankings and completion times.
          </p>
        </div>

        {groupQuizId && leaderboard.length > 0 && (
          <button
            onClick={announceToChat}
            disabled={sharing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 disabled:opacity-60 cursor-pointer"
          >
            <Send size={13} /> {sharing ? 'Announcing…' : 'Announce in Chat'}
          </button>
        )}
      </div>

      {leaderboard.length === 0 ? (
        <EmptyState title="No results yet" subtitle="Scores will appear here as soon as group members submit." />
      ) : (
        <>
          {/* Top 3 Podium Showcase */}
          {groupQuizId && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2">
              {/* 2nd Place */}
              <div className="flex flex-col items-center justify-end text-center p-3 rounded-2xl border border-slate-800 bg-slate-900/40">
                <span className="text-2xl sm:text-3xl mb-1">🥈</span>
                <span className="text-xs font-bold text-slate-300 truncate w-full">{p2?.user?.name || '—'}</span>
                <span className="text-[11px] text-slate-500 mt-0.5">{p2 ? `${p2.score} pts` : '—'}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-2 bg-slate-800 px-2 py-0.5 rounded-full">2nd Place</span>
              </div>

              {/* 1st Place Gold */}
              <div className="flex flex-col items-center justify-end text-center p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-slate-900 shadow-lg shadow-amber-500/10 -translate-y-2">
                <span className="text-3xl sm:text-4xl mb-1">👑</span>
                <span className="text-xs sm:text-sm font-bold text-amber-200 truncate w-full">{p1?.user?.name || '—'}</span>
                <span className="text-xs font-extrabold text-amber-400 mt-0.5">{p1 ? `${p1.score} pts` : '—'}</span>
                {p1?.timeTakenSecs != null && (
                  <span className="text-[10px] text-amber-400/80 mt-0.5">{p1.timeTakenSecs}s</span>
                )}
                <span className="text-[10px] font-bold text-slate-950 mt-2 bg-amber-400 px-2.5 py-0.5 rounded-full">Champion</span>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center justify-end text-center p-3 rounded-2xl border border-slate-800 bg-slate-900/40">
                <span className="text-2xl sm:text-3xl mb-1">🥉</span>
                <span className="text-xs font-bold text-slate-300 truncate w-full">{p3?.user?.name || '—'}</span>
                <span className="text-[11px] text-slate-500 mt-0.5">{p3 ? `${p3.score} pts` : '—'}</span>
                <span className="text-[10px] font-bold text-amber-700/80 mt-2 bg-slate-800 px-2 py-0.5 rounded-full">3rd Place</span>
              </div>
            </div>
          )}

          {/* Full Rank Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl divide-y divide-slate-800/80">
            {leaderboard.map((entry, index) => {
              const rank = entry.rank || index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              return (
                <div
                  key={entry.user?.id || rank}
                  className={`flex items-center justify-between px-4 py-3.5 text-xs sm:text-sm transition-colors ${
                    isFirst ? 'bg-amber-500/5' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isFirst
                          ? 'bg-amber-400 text-slate-950'
                          : isSecond
                          ? 'bg-slate-300 text-slate-950'
                          : isThird
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rank}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">{entry.user?.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {entry.user?.username ? `@${entry.user.username}` : 'Student'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-100 flex items-center justify-end gap-1">
                      <Award size={13} className={isFirst ? 'text-amber-400' : 'text-slate-500'} />
                      <span>{entry.score} pts</span>
                    </div>
                    {entry.timeTakenSecs != null && (
                      <span className="text-[10px] text-slate-500">{entry.timeTakenSecs}s completion</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
