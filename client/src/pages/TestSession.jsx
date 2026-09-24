import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Flag,
  HelpCircle,
  Send,
  EyeOff,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import QuizCard from '../components/QuizCard.jsx';

export default function TestSession() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [questionTimeMap, setQuestionTimeMap] = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const currentIdxRef = useRef(0);
  currentIdxRef.current = currentIdx;

  const { data: attempt, isLoading, error } = useQuery({
    queryKey: ['standard-test-attempt', attemptId],
    queryFn: () => api.get(`/tests/${attemptId}`).then((r) => r.data.data.attempt || r.data.data),
    staleTime: 60000,
  });

  const questions = attempt?.questions || [];
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;

  // If already submitted, redirect to results
  useEffect(() => {
    if (attempt?.isSubmitted) {
      navigate(`/tests/${attemptId}/results`, { replace: true });
    }
  }, [attempt, attemptId, navigate]);

  // Overall timer
  useEffect(() => {
    if (!attempt?.isSubmitted) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [attempt]);

  // Per-question timer tracking
  useEffect(() => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const interval = setInterval(() => {
      setQuestionTimeMap((prev) => ({
        ...prev,
        [qId]: (prev[qId] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Anti-cheat focus tracking: tab switches & window blur
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((c) => {
          const next = c + 1;
          if (next === 1) {
            showToast('Focus warning: Tab switch detected', 'warning');
          } else if (next >= 3) {
            showToast(`Focus warning: ${next} tab switches logged`, 'error');
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showToast]);

  // Handle select option
  const handleSelectOption = useCallback((optionKey) => {
    const q = questions[currentIdxRef.current];
    if (!q) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [q.id]: optionKey,
    }));
  }, [questions]);

  // Handle toggle flag
  const handleToggleFlag = useCallback(() => {
    const q = questions[currentIdxRef.current];
    if (!q) return;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) {
        next.delete(q.id);
      } else {
        next.add(q.id);
      }
      return next;
    });
  }, [questions]);

  // Keyboard navigation & hotkeys: Arrows, 1-4, A-D, F
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIdx((idx) => Math.max(0, idx - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIdx((idx) => Math.min(totalQuestions - 1, idx + 1));
      } else if (key === 'F') {
        e.preventDefault();
        handleToggleFlag();
      } else if (key === '1' || key === 'A') {
        e.preventDefault();
        handleSelectOption('A');
      } else if (key === '2' || key === 'B') {
        e.preventDefault();
        handleSelectOption('B');
      } else if (key === '3' || key === 'C') {
        e.preventDefault();
        handleSelectOption('C');
      } else if (key === '4' || key === 'D') {
        e.preventDefault();
        handleSelectOption('D');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalQuestions, handleSelectOption, handleToggleFlag]);

  // Submit test handler
  const handleSubmitTest = async () => {
    setSubmitting(true);
    try {
      const responses = questions.map((q) => ({
        questionId: q.id,
        selectedOption: selectedAnswers[q.id] || null,
        timeSpentSeconds: questionTimeMap[q.id] || 0,
        isFlagged: flaggedQuestions.has(q.id),
      }));

      const payload = {
        answers: responses,
        durationSeconds: elapsedSeconds,
        timeTakenSecs: elapsedSeconds,
        tabSwitchCount,
        telemetry: {
          tab_switch_count: tabSwitchCount,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
          completed_at: new Date().toISOString(),
        },
      };

      const res = await api.post(`/tests/${attemptId}/submit`, payload);
      showToast('Test submitted successfully!', 'success');
      navigate(`/tests/${attemptId}/results`, {
        state: res.data?.data || res.data,
      });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit test', 'error');
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <Skeleton className="h-80 max-w-3xl mx-auto rounded-2xl" />;
  }

  if (error || !attempt) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-slate-400">
        <AlertCircle size={44} className="mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-slate-200">Unable to load test session</h2>
        <p className="text-sm mt-1">{error?.response?.data?.message || 'Test attempt not found.'}</p>
        <button
          onClick={() => navigate('/question-bank')}
          className="mt-5 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/20"
        >
          Return to Question Bank
        </button>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).filter((k) => !!selectedAnswers[k]).length;
  const flaggedCount = flaggedQuestions.size;
  const unansweredCount = totalQuestions - answeredCount;
  const isLast = currentIdx === totalQuestions - 1;
  const progressPercentage = totalQuestions > 0 ? ((answeredCount) / totalQuestions) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header Card: Title, Focus Warning, Timer & Status */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {attempt.subject?.name || attempt.subject?.subjectName || 'Physics 9'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {attempt.chapter?.title || attempt.chapter?.chapterName
                ? `Ch. ${attempt.chapter.chapterNumber || ''}: ${attempt.chapter.title || attempt.chapter.chapterName}`
                : 'PTB Curriculum'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1.5" style={{ fontFamily: 'Poppins' }}>
            {attempt.title || 'Board Practice Test'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          {/* Anti-cheat tab switch warning */}
          {tabSwitchCount > 0 && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                tabSwitchCount >= 3
                  ? 'bg-red-500/15 text-red-300 border-red-500/30 animate-pulse'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
              title="Window blur / tab switches detected by anti-cheat tracker"
            >
              <ShieldAlert size={14} />
              <span>Tab switches: {tabSwitchCount}</span>
            </div>
          )}

          {/* Timer */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 font-mono text-sm shadow-inner">
            <Clock size={15} className="text-blue-400" />
            <span className="font-semibold">{formatTimer(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar & Counter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
          <span>Overall Progress: {Math.round(progressPercentage)}%</span>
          <span>
            <strong className="text-blue-400">{answeredCount}</strong> answered •{' '}
            <strong className="text-amber-400">{flaggedCount}</strong> flagged •{' '}
            <strong className="text-slate-400">{unansweredCount}</strong> remaining
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Question Rail (Numbered palette with color states) */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Question Navigator
          </span>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 ring-2 ring-blue-400/40" /> Current
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" /> Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Flagged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700" /> Untouched
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIdx;
            const isAnswered = !!selectedAnswers[q.id];
            const isFlagged = flaggedQuestions.has(q.id);

            let btnClasses = 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700';

            if (isCurrent) {
              btnClasses = 'border-2 border-blue-500 bg-blue-500/25 text-white font-bold ring-2 ring-blue-500/20 shadow-sm';
            } else if (isFlagged) {
              btnClasses = 'border border-amber-500/60 bg-amber-500/20 text-amber-300 font-semibold';
            } else if (isAnswered) {
              btnClasses = 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-semibold';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`relative w-9 h-9 rounded-xl text-xs shrink-0 transition-all flex items-center justify-center cursor-pointer ${btnClasses}`}
                title={`Question ${idx + 1}${isFlagged ? ' (Flagged)' : ''}${isAnswered ? ' (Answered)' : ''}`}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-slate-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card with Keyboard Badges & Flagging */}
      <QuizCard
        question={currentQuestion}
        selectedOption={selectedAnswers[currentQuestion?.id] || null}
        isFlagged={flaggedQuestions.has(currentQuestion?.id)}
        onSelectOption={handleSelectOption}
        onToggleFlag={handleToggleFlag}
        questionIndex={currentIdx}
        totalQuestions={totalQuestions}
      />

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => i - 1)}
          className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Previous</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-500">
            ←
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
          >
            <CheckCircle2 size={16} />
            <span>Finish & Submit</span>
          </button>

          {!isLast && (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => i + 1)}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              <span>Next</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-blue-600/60 border border-blue-400/40 rounded text-white">
                →
              </kbd>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="text-center text-xs text-slate-500 hidden sm:flex items-center justify-center gap-4 pt-1">
        <span>Hotkeys:</span>
        <span>
          <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">←</kbd> / <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">→</kbd> Navigate
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">1-4</kbd> or <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">A-D</kbd> Select Option
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">F</kbd> Toggle Flag
        </span>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                  Submit Your Test?
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm test completion and generate grading & AI diagnostics.
                </p>
              </div>
            </div>

            {/* Summary counters */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
              <div className="p-2">
                <p className="text-xs text-slate-400 font-medium">Answered</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{answeredCount}</p>
              </div>
              <div className="p-2 border-x border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Flagged</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{flaggedCount}</p>
              </div>
              <div className="p-2">
                <p className="text-xs text-slate-400 font-medium">Unanswered</p>
                <p className="text-lg font-bold text-slate-300 mt-0.5">{unansweredCount}</p>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
                <span>
                  You have <strong>{unansweredCount}</strong> unanswered question(s). Unanswered questions count as zero.
                </span>
              </div>
            )}

            {tabSwitchCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-xs text-slate-400">
                <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                <span>Anti-cheat telemetry recorded {tabSwitchCount} tab switch(es).</span>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Keep Reviewing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitTest}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
              >
                <Send size={15} />
                <span>{submitting ? 'Submitting...' : 'Yes, Submit Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

