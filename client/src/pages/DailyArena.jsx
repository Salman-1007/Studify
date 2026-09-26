import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Flame,
  Zap,
  Clock,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  Layers,
  ChevronRight,
  ChevronLeft,
  Flag,
  Share2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

// Format seconds into HH:MM:SS
const formatTimer = (totalSecs) => {
  const s = Math.max(0, totalSecs);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs > 0 ? String(hrs).padStart(2, '0') + 'h : ' : ''}${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`;
};

const SUBJECT_COLORS = {
  Biology: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Chemistry: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Physics: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Mathematics: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  English: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'Logical Reasoning': 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
  General: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function DailyArena() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Arena Config States
  const [selectedTrack, setSelectedTrack] = useState(() => user?.grade || '9');
  const [mode, setMode] = useState('GRAND'); // 'SOLO' | 'MULTI' | 'GRAND'
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [activeTab, setActiveTab] = useState('arena'); // 'arena' | 'leaderboard'

  // Test Runner States
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL' | 'MISTAKES' | 'FLAGGED'

  // Daily Status Query
  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['daily-arena-status'],
    queryFn: () => api.get('/daily-arena/status').then((r) => r.data.data),
    refetchInterval: 30000,
  });

  // Subjects for selected track
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['curriculum-subjects-daily', selectedTrack],
    queryFn: () =>
      api
        .get('/curriculum/subjects', {
          params: {
            classGrade: selectedTrack,
          },
        })
        .then((r) => r.data.data.subjects),
  });

  // Leaderboard Query
  const { data: leaderboardData } = useQuery({
    queryKey: ['daily-arena-leaderboard', selectedTrack],
    queryFn: () => api.get('/daily-arena/leaderboard').then((r) => r.data.data),
    enabled: activeTab === 'leaderboard' || !!result,
  });

  // Live Reset Countdown Timer
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (status?.secondsUntilReset) {
      setCountdown(status.secondsUntilReset);
    }
  }, [status]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Active Test Countdown Timer
  useEffect(() => {
    if (!session || result || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [session, result, timeRemaining]);

  // Anti-cheat visibility listener
  useEffect(() => {
    if (!session || result) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((s) => s + 1);
        showToast('Warning: Tab switch detected during Daily Arena exam!', 'error');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [session, result]);

  // Keyboard navigation
  useEffect(() => {
    if (!session || result) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const q = session.questions[currentIndex];
      if (!q) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(session.questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (['1', 'a', 'A'].includes(e.key)) {
        handleSelectOption(q.questionId, 'A');
      } else if (['2', 'b', 'B'].includes(e.key)) {
        handleSelectOption(q.questionId, 'B');
      } else if (['3', 'c', 'C'].includes(e.key)) {
        handleSelectOption(q.questionId, 'C');
      } else if (['4', 'd', 'D'].includes(e.key)) {
        handleSelectOption(q.questionId, 'D');
      } else if (['f', 'F'].includes(e.key)) {
        toggleFlag(q.questionId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, currentIndex, result, answers]);

  const handleStartArena = async () => {
    try {
      setSubmitting(true);
      const res = await api.post('/daily-arena/generate', {
        track: selectedTrack,
        mode,
        subjectIds: selectedSubjectIds,
        questionCount,
      });

      const s = res.data.data;
      setSession(s);
      setTimeRemaining(s.durationSeconds);
      setCurrentIndex(0);
      setAnswers({});
      setFlagged(new Set());
      setTabSwitches(0);
      setResult(null);
      showToast('Daily Arena Challenge started! Good luck!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to start daily challenge', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectOption = (questionId, optionKey) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const toggleFlag = (questionId) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmitTest = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const durationSeconds = Math.max(1, session.durationSeconds - timeRemaining);
      const responses = session.questions.map((q) => ({
        questionId: q.questionId,
        selectedOption: answers[q.questionId] || null,
        timeSpentSeconds: Math.round(durationSeconds / session.questions.length),
      }));

      const res = await api.post('/daily-arena/submit', {
        attemptId: session.attemptId,
        durationSeconds,
        responses,
      });

      setResult(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['daily-arena-status'] });
      queryClient.invalidateQueries({ queryKey: ['daily-arena-leaderboard'] });
      showToast(`Daily Arena Completed! +${res.data.data.bonusXp} Bonus XP Earned!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit exam', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSubjectSelect = (subId) => {
    setSelectedSubjectIds((prev) => {
      if (prev.includes(subId)) return prev.filter((id) => id !== subId);
      return [...prev, subId];
    });
  };

  // Current active question
  const currentQ = session?.questions?.[currentIndex];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Banner / HUD Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles size={14} className="text-amber-400" />
              Daily Mock Arena · National Blueprint
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
              Daily Mock Challenge
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Sharpen your speed and accuracy with board & entry-test synchronized daily mocks. Earn streak multipliers and climb today&apos;s leaderboard.
            </p>
          </div>

          {/* Daily Status Badges & Countdown HUD */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                <Flame size={20} />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-medium">Daily Streak</span>
                <span className="text-base font-bold text-white">{status?.streakCount || 0} Days</span>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur border border-slate-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Clock size={20} />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-medium">Resets In</span>
                <span className="text-base font-mono font-bold text-amber-400">
                  {countdown > 0 ? formatTimer(countdown) : '00m : 00s'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switch between Arena & Leaderboard */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => {
              setActiveTab('arena');
              setResult(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'arena'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Daily Arena
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'leaderboard'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy size={14} className="text-amber-400" />
            Today&apos;s Leaderboard
          </button>
        </div>
      </div>

      {/* VIEW 1: ACTIVE TEST RUNNER */}
      {session && !result && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Question Card */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                    Question {currentIndex + 1} of {session.questions.length}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
                      SUBJECT_COLORS[currentQ?.subjectName] || SUBJECT_COLORS.General
                    }`}
                  >
                    {currentQ?.subjectName || 'Subject'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleFlag(currentQ?.questionId)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      flagged.has(currentQ?.questionId)
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flag size={14} fill={flagged.has(currentQ?.questionId) ? 'currentColor' : 'none'} />
                    {flagged.has(currentQ?.questionId) ? 'Flagged' : 'Flag for review'}
                  </button>

                  <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono font-bold text-amber-400">
                    <Clock size={14} />
                    {formatTimer(timeRemaining)}
                  </div>
                </div>
              </div>

              {/* Question Body */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-100 leading-relaxed">
                  {currentQ?.questionText}
                </h3>

                {/* Options List */}
                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  {['A', 'B', 'C', 'D'].map((optKey) => {
                    const optVal = currentQ?.[`option${optKey}`];
                    if (!optVal) return null;
                    const isSelected = answers[currentQ?.questionId] === optKey;

                    return (
                      <button
                        key={optKey}
                        onClick={() => handleSelectOption(currentQ.questionId, optKey)}
                        className={`text-left p-4 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                            : 'bg-slate-800/40 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {optKey}
                        </span>
                        <span className="text-sm font-medium leading-relaxed">{optVal}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-800">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                <div className="text-xs text-slate-500 hidden sm:block">
                  Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-slate-800 rounded">1-4</kbd> to select, <kbd className="px-1 py-0.5 bg-slate-800 rounded">F</kbd> to flag
                </div>

                {currentIndex === session.questions.length - 1 ? (
                  <button
                    onClick={handleSubmitTest}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> {submitting ? 'Submitting…' : 'Submit Challenge'}
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIndex((i) => Math.min(session.questions.length - 1, i + 1))}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Side Question Rail */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Questions Rail</h4>
              <div className="grid grid-cols-5 gap-2">
                {session.questions.map((q, idx) => {
                  const isAnswered = !!answers[q.questionId];
                  const isFlag = flagged.has(q.questionId);
                  const isCurrent = idx === currentIndex;

                  let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-400';
                  if (isAnswered) bgClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                  if (isFlag) bgClass = 'bg-amber-500/20 border-amber-500/40 text-amber-400';
                  if (isCurrent) bgClass += ' ring-2 ring-blue-500 border-blue-500 font-bold';

                  return (
                    <button
                      key={q.questionId}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-lg border text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${bgClass}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
                  Answered ({Object.keys(answers).length})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50" />
                  Flagged for review ({flagged.size})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                  Unanswered ({session.questions.length - Object.keys(answers).length})
                </div>
              </div>

              <button
                onClick={handleSubmitTest}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 size={16} /> Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: POST-TEST RESULTS & PERFORMANCE MATRIX */}
      {result && (
        <div className="space-y-6">
          {/* Hero Score Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <Award size={14} /> Challenge Completed!
                </div>
                <h2 className="text-2xl font-bold text-white">Your Daily Arena Diagnostic</h2>
                <p className="text-slate-400 text-sm">
                  You answered {result.correctCount} of {result.totalQuestions} questions correctly in {Math.round(result.timeTakenSecs / 60)} minutes.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-3xl font-extrabold text-blue-400">{result.percentage}%</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block mt-1">Accuracy</span>
                </div>
                <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-3xl font-extrabold text-amber-400">+{result.earnedXp}</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block mt-1">XP Earned</span>
                </div>
              </div>
            </div>

            {/* Subject Mastery Radar Breakdown */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Subject-by-Subject Performance Breakdown
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(result.subjectBreakdown || {}).map(([subject, stats]) => (
                  <div key={subject} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-200">{subject}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        stats.percentage >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                        stats.percentage >= 50 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {stats.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stats.percentage >= 80 ? 'bg-emerald-400' :
                          stats.percentage >= 50 ? 'bg-amber-400' :
                          'bg-rose-400'
                        }`}
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {stats.correct} correct, {stats.wrong} mistakes
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setSession(null);
                  setResult(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2"
              >
                <RotateCcw size={15} /> Retake / Another Track
              </button>
              <Link
                to="/question-bank"
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium flex items-center gap-2"
              >
                <BookOpen size={15} /> Drill in Question Bank
              </Link>
            </div>
          </div>

          {/* Question Review Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Detailed Solutions & Explanations</h3>
              <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
                {['ALL', 'MISTAKES'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setReviewFilter(filter)}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      reviewFilter === filter ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter === 'ALL' ? 'All Questions' : 'Mistakes Only'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {result.reviewQuestions
                .filter((q) => (reviewFilter === 'MISTAKES' ? !q.isCorrect : true))
                .map((q, idx) => (
                  <div
                    key={q.questionId}
                    className={`p-4 rounded-xl border space-y-3 ${
                      q.isCorrect
                        ? 'bg-slate-800/20 border-emerald-500/30'
                        : 'bg-rose-500/5 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">Question {idx + 1} · {q.subjectName}</span>
                      <span className={`font-semibold flex items-center gap-1 ${q.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {q.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {q.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <h4 className="text-sm font-medium text-slate-200">{q.questionText}</h4>

                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {['A', 'B', 'C', 'D'].map((optKey) => {
                        const optVal = q[`option${optKey}`];
                        if (!optVal) return null;
                        const isChosen = q.selectedOption === optKey;
                        const isCorrectKey = q.correctAnswer === optKey;

                        let style = 'bg-slate-800/40 border-slate-700 text-slate-400';
                        if (isCorrectKey) style = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold';
                        else if (isChosen && !isCorrectKey) style = 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold';

                        return (
                          <div key={optKey} className={`p-2.5 rounded-lg border flex items-center gap-2 ${style}`}>
                            <span className="font-bold">{optKey}.</span>
                            <span>{optVal}</span>
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 text-xs text-slate-300">
                        <span className="font-bold text-blue-400">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ARENA CONFIGURATION & MODE SELECTOR */}
      {!session && !result && activeTab === 'arena' && (
        <div className="space-y-6">
          {/* Step 1: Select Track / Grade */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">1. Select Curriculum Track</h3>
                <p className="text-xs text-slate-400 mt-0.5">Explore any matric, intermediate, or medical/engineering entrance exam.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: '9', label: 'Class 9 (Matric 1)' },
                { id: '10', label: 'Class 10 (Matric 2)' },
                { id: '11', label: 'Class 11 (FSc 1)' },
                { id: '12', label: 'Class 12 (FSc 2)' },
                { id: 'MDCAT', label: 'MDCAT (Pre-Medical)' },
                { id: 'ECAT', label: 'ECAT (Engineering)' },
              ].map((trk) => (
                <button
                  key={trk.id}
                  onClick={() => {
                    setSelectedTrack(trk.id);
                    setSelectedSubjectIds([]);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                    selectedTrack === trk.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {trk.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Select Mode */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">2. Choose Exam Mode</h3>
              <p className="text-xs text-slate-400 mt-0.5">Single-subject sprint, multi-subject combo, or grand full-length simulation.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  id: 'GRAND',
                  title: 'Grand All-Subject Simulation',
                  desc: 'A full-spectrum mock covering all syllabus subjects with official weightage distribution.',
                  badge: 'Recommended',
                  icon: Trophy,
                  accent: 'border-blue-500/40 hover:border-blue-500',
                },
                {
                  id: 'MULTI',
                  title: 'Custom Multi-Subject Combo',
                  desc: 'Pick 2 or more subjects to practice combined questions at your custom pace.',
                  badge: 'Customizable',
                  icon: Layers,
                  accent: 'border-cyan-500/40 hover:border-cyan-500',
                },
                {
                  id: 'SOLO',
                  title: 'Solo Subject Sprint',
                  desc: 'High-speed 10-question sprint focusing purely on one specific subject.',
                  badge: 'Fast Pace',
                  icon: Zap,
                  accent: 'border-amber-500/40 hover:border-amber-500',
                },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = mode === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700">
                        <Icon size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {m.badge}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100 text-sm">{m.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Subject Selector for Solo / Multi Modes */}
            {(mode === 'SOLO' || mode === 'MULTI') && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {mode === 'SOLO' ? 'Select 1 Subject for Sprint:' : 'Select Subjects for Combo:'}
                </span>

                {loadingSubjects ? (
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-28 rounded-lg" />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {subjects.map((sub) => {
                      const isPicked = selectedSubjectIds.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (mode === 'SOLO') setSelectedSubjectIds([sub.id]);
                            else toggleSubjectSelect(sub.id);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isPicked
                              ? 'bg-blue-500 text-white border-blue-400 shadow-sm'
                              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {sub.bookName || sub.subjectName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Question Count & Start Button */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">MCQs Count:</span>
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                {[10, 15, 20].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setQuestionCount(cnt)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      questionCount === cnt ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartArena}
              disabled={submitting}
              className="py-3 px-8 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
            >
              <Play size={18} fill="currentColor" />
              {submitting ? 'Preparing Daily Arena…' : 'Enter Daily Arena'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 4: TODAY'S LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Daily Arena Leaderboard</h3>
              <p className="text-xs text-slate-400 mt-0.5">Top scorers on today&apos;s synchronized national challenge.</p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
              {status?.date}
            </span>
          </div>

          {!leaderboardData?.leaderboard?.length ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Trophy size={36} className="mx-auto text-slate-600 mb-2" />
              No scores recorded yet for today! Be the first to complete the Daily Arena challenge.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {leaderboardData.leaderboard.map((item, idx) => (
                <div key={item.userId} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="text-sm font-semibold text-slate-200">{item.name}</h5>
                      <span className="text-xs text-slate-500">Level {item.level || 1}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-100">{item.score} / {item.totalQuestions}</span>
                      <span className="text-[11px] text-slate-400 block">{item.percentage}%</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {Math.floor(item.timeTakenSecs / 60)}m {item.timeTakenSecs % 60}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
