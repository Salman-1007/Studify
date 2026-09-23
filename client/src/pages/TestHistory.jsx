import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { History, Award, CheckCircle2, Clock, ChevronRight, BookOpen, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function TestHistory() {
  const navigate = useNavigate();

  const { data: attempts, isLoading } = useQuery({
    queryKey: ['standard-test-history'],
    queryFn: () => api.get('/tests/history').then((r) => r.data.data.attempts),
  });

  const getPercentageColor = (pct) => {
    if (pct >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (pct >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
            Standardized Test History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review past scores, accuracy, and detailed question explanations from Punjab Textbook Board tests.
          </p>
        </div>

        <Link
          to="/question-bank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 self-start sm:self-auto"
        >
          <BookOpen size={16} />
          Question Bank
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !attempts || attempts.length === 0 ? (
        <EmptyState
          title="No standardized tests taken yet"
          subtitle="Start a test from the Punjab Textbook Board Class 9 Physics question bank to test your knowledge!"
          action={
            <Link
              to="/question-bank"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
            >
              Take a Practice Test <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {attempts.map((att) => {
            const isCompleted = att.isSubmitted;
            return (
              <div
                key={att.id}
                onClick={() => navigate(isCompleted ? `/tests/${att.id}/results` : `/tests/${att.id}`)}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70 p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
                      {att.subject?.name || 'Class 9 Physics'}
                    </span>
                    {att.chapter && (
                      <span className="text-xs text-slate-400 font-medium">
                        Ch. {att.chapter.chapterNumber}: {att.chapter.title}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(att.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-200 text-base">{att.title}</p>
                  <p className="text-xs text-slate-400">
                    {att.totalQuestions} questions · Mode: {att.mode}
                  </p>
                </div>

                {/* Score & Action */}
                <div className="flex items-center gap-4 self-end sm:self-auto">
                  {isCompleted ? (
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-base font-bold text-white">
                          {att.score} / {att.totalQuestions}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getPercentageColor(
                            att.percentage
                          )}`}
                        >
                          {Math.round(att.percentage)}%
                        </span>
                      </div>
                      <p className="text-xs text-amber-400 font-medium mt-0.5">+{att.xpEarned} XP</p>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      In Progress
                    </span>
                  )}

                  <ChevronRight size={18} className="text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

