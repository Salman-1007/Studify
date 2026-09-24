import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Clock, BookOpen, Sparkles, CheckCircle2, Play, Filter } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Quizzes() {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'BANK' | 'AI'

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/quizzes').then((r) => r.data.data.quizzes),
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ['quiz-attempts'],
    queryFn: () => api.get('/quiz-attempts').then((r) => r.data.data.attempts),
  });

  const filteredQuizzes = quizzes.filter((q) => {
    if (filter === 'BANK') return q.source === 'question_bank';
    if (filter === 'AI') return q.source !== 'question_bank';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Official Board Question Bank Feature Card */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/30 via-slate-900/60 to-slate-900/40 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Official Curriculum
            </span>
            <span className="text-xs text-slate-400">Class 9 · Punjab Textbook Board / PECTAA</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
            Board Exam Question Bank & Chapter Tests
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Practice verified multiple-choice questions covering Class 9 Physics with real-time scoring, server-validated XP, and Gemini AI mistake diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/quizzes/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus size={15} />
            Create Quiz
          </Link>
          <Link
            to="/question-bank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <BookOpen size={15} />
            Question Bank
          </Link>
        </div>
      </div>

      {/* Main Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            Practice Quizzes
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate quizzes directly from official textbook chapters or with AI
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'ALL' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('BANK')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'BANK' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Question Bank
          </button>
          <button
            type="button"
            onClick={() => setFilter('AI')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'AI' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AI Generated
          </button>
        </div>
      </div>

      {/* Quizzes Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <EmptyState
          title="No quizzes found"
          subtitle="Click 'Create Quiz' above to generate one from the Punjab Question Bank or with AI."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map((q) => {
            const isBank = q.source === 'question_bank';

            return (
              <Link
                key={q.id}
                to={`/quizzes/${q.id}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 p-5 space-y-3 transition-all hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isBank
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      }`}
                    >
                      {isBank ? <BookOpen size={11} /> : <Sparkles size={11} />}
                      {isBank ? 'Curriculum Bank' : 'AI Generated'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {q.difficulty || 'MEDIUM'}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm sm:text-base group-hover:text-blue-400 transition-colors line-clamp-2">
                    {q.title}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {q.topic || 'General'} {q.subject ? `• ${q.subject}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-medium">
                    {q._count?.questions || 0} questions
                  </span>
                  <span className="text-blue-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Start Quiz <Play size={12} className="fill-blue-400" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quiz History */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Poppins' }}>
          Recent Quiz Attempts
        </h2>
        {!attempts || attempts.length === 0 ? (
          <p className="text-xs text-slate-400">No attempts completed yet.</p>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/80 overflow-hidden">
            {attempts.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3.5 text-xs sm:text-sm">
                <div>
                  <p className="font-semibold text-slate-200">{a.quiz?.title}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={12} /> {new Date(a.createdAt).toLocaleDateString()} • {a.timeTakenSecs}s duration
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold text-sm ${
                      a.percentage >= 80 ? 'text-emerald-400' : a.percentage >= 50 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {Math.round(a.percentage)}%
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {a.score}/{a.totalQuestions}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
