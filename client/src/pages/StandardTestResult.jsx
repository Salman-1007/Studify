import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, MinusCircle, Award, Sparkles, ArrowRight, RotateCcw, BookOpen, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';

export default function StandardTestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { data: attempt, isLoading, error } = useQuery({
    queryKey: ['standard-test-result', attemptId],
    queryFn: () => api.get(`/tests/${attemptId}`).then((r) => r.data.data.attempt),
  });

  if (isLoading) {
    return <Skeleton className="h-72 max-w-3xl mx-auto" />;
  }

  if (error || !attempt) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-slate-400">
        <p className="text-slate-200 font-medium">Unable to load test results.</p>
        <button
          onClick={() => navigate('/question-bank')}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm"
        >
          Return to Question Bank
        </button>
      </div>
    );
  }

  const {
    title,
    score,
    totalQuestions,
    percentage,
    xpEarned,
    timeTakenSeconds,
    questionAttempts = [],
    subject,
    chapter,
  } = attempt;

  const correctCount = questionAttempts.filter((q) => q.isCorrect).length;
  const incorrectCount = questionAttempts.filter((q) => !q.isCorrect && q.selectedOption).length;
  const skippedCount = questionAttempts.filter((q) => !q.selectedOption).length;

  const getPercentageColor = (pct) => {
    if (pct >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (pct >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Top Banner & Score Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/15 text-blue-400">
                {subject?.name || 'Class 9 Physics'}
              </span>
              <span className="text-xs text-slate-400">
                {chapter ? `Ch. ${chapter.chapterNumber}: ${chapter.title}` : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/question-bank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <RotateCcw size={14} />
              New Test
            </Link>
            <Link
              to="/tests/history"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-xs font-medium text-white shadow-md shadow-blue-500/20"
            >
              All History
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Score & Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Score & Percentage */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
            <p className="text-xs text-slate-400 font-medium">Final Score</p>
            <p className="text-2xl font-bold text-white mt-1" style={{ fontFamily: 'Poppins' }}>
              {score} <span className="text-sm font-normal text-slate-500">/ {totalQuestions}</span>
            </p>
            <div className={`inline-block px-2 py-0.5 mt-1 rounded text-xs font-semibold border ${getPercentageColor(percentage)}`}>
              {Math.round(percentage)}%
            </div>
          </div>

          {/* XP Earned */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
            <p className="text-xs text-slate-400 font-medium">XP Earned</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 flex items-center justify-center gap-1" style={{ fontFamily: 'Poppins' }}>
              <Sparkles size={18} />
              +{xpEarned}
            </p>
            <p className="text-xs text-slate-500 mt-1">Saved to profile</p>
          </div>

          {/* Breakdown */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
            <p className="text-xs text-slate-400 font-medium">Accuracy</p>
            <div className="flex items-center justify-center gap-3 mt-2 text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> {correctCount}
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <XCircle size={13} /> {incorrectCount}
              </span>
              {skippedCount > 0 && (
                <span className="text-slate-400 flex items-center gap-1">
                  <MinusCircle size={13} /> {skippedCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Correct / Wrong</p>
          </div>

          {/* Time Taken */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-center">
            <p className="text-xs text-slate-400 font-medium">Time Taken</p>
            <p className="text-2xl font-bold text-slate-200 mt-1 font-mono">
              {timeTakenSeconds ? `${Math.floor(timeTakenSeconds / 60)}m ${timeTakenSeconds % 60}s` : 'Untimed'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Total duration</p>
          </div>
        </div>
      </div>

      {/* Question by Question Review */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
          <BookOpen size={18} className="text-blue-400" />
          Question Review & Explanations
        </h2>

        <div className="space-y-4">
          {questionAttempts.map((qa, index) => {
            const q = qa.questionBankItem;
            const isCorrect = qa.isCorrect;
            const selected = qa.selectedOption;
            const correct = qa.correctOption;

            const options = [
              { key: 'A', text: q?.optionA },
              { key: 'B', text: q?.optionB },
              { key: 'C', text: q?.optionC },
              { key: 'D', text: q?.optionD },
            ];

            return (
              <div
                key={qa.id || index}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6 space-y-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Q{index + 1}
                    </span>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={13} /> Correct (+10 XP)
                      </span>
                    ) : selected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        <XCircle size={13} /> Incorrect
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        <MinusCircle size={13} /> Skipped
                      </span>
                    )}
                  </div>

                  {q?.difficulty && (
                    <span className="text-xs text-slate-400 font-mono">
                      {q.difficulty}
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <p className="text-sm sm:text-base font-medium text-slate-200">
                  {q?.questionText}
                </p>

                {/* Options List */}
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {options.map(({ key, text }) => {
                    const isTargetCorrect = key === correct;
                    const isUserChoice = key === selected;

                    let optStyle = 'border-slate-800 bg-slate-900/30 text-slate-400';
                    let badgeStyle = 'border-slate-700 bg-slate-800 text-slate-500';

                    if (isTargetCorrect) {
                      optStyle = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 font-medium';
                      badgeStyle = 'bg-emerald-500 text-white font-bold';
                    } else if (isUserChoice && !isCorrect) {
                      optStyle = 'border-red-500/50 bg-red-500/10 text-red-200';
                      badgeStyle = 'bg-red-500 text-white font-bold';
                    }

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center gap-3 transition-colors ${optStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-md text-xs flex items-center justify-center shrink-0 border ${badgeStyle}`}>
                          {key}
                        </span>
                        <span className="flex-1">{text}</span>
                        {isTargetCorrect && (
                          <span className="text-xs font-semibold text-emerald-400 shrink-0">Correct</span>
                        )}
                        {isUserChoice && !isTargetCorrect && (
                          <span className="text-xs font-semibold text-red-400 shrink-0">Your pick</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {qa.explanation && (
                  <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-blue-400">Board Syllabus Explanation:</p>
                    <p className="leading-relaxed text-slate-300">{qa.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

