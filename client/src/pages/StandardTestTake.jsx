import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function StandardTestTake() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const timerRef = useRef(null);

  const { data: attempt, isLoading, error } = useQuery({
    queryKey: ['standard-test-attempt', attemptId],
    queryFn: () => api.get(`/tests/${attemptId}`).then((r) => r.data.data.attempt),
  });

  // If already submitted, automatically redirect to results
  useEffect(() => {
    if (attempt?.isSubmitted) {
      navigate(`/tests/${attemptId}/results`, { replace: true });
    }
  }, [attempt, attemptId, navigate]);

  // Timer tick
  useEffect(() => {
    if (!attempt?.isSubmitted) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [attempt]);

  if (isLoading) {
    return <Skeleton className="h-72 max-w-2xl mx-auto" />;
  }

  if (error || !attempt) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-slate-400">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-slate-200">Unable to load test</h2>
        <p className="text-sm mt-1">{error?.response?.data?.message || 'Test attempt not found.'}</p>
        <button
          onClick={() => navigate('/question-bank')}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium"
        >
          Return to Question Bank
        </button>
      </div>
    );
  }

  const questions = attempt.questions || [];
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIdx === totalQuestions - 1;

  const handleSelectOption = (optKey) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optKey,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payloadAnswers = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
        timeSpentSeconds: 0,
      }));

      const res = await api.post(`/tests/${attemptId}/submit`, { answers: payloadAnswers });
      showToast('Test submitted successfully!', 'success');
      navigate(`/tests/${attemptId}/results`, { state: res.data.data });
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

  const optionsList = [
    { key: 'A', text: currentQuestion?.optionA },
    { key: 'B', text: currentQuestion?.optionB },
    { key: 'C', text: currentQuestion?.optionC },
    { key: 'D', text: currentQuestion?.optionD },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Bar with Title, Timer & Progress */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/20 text-blue-400">
              {attempt.subject?.name || 'Class 9 Physics'}
            </span>
            <span className="text-xs text-slate-400">
              {attempt.chapter?.title ? `Ch. ${attempt.chapter.chapterNumber}: ${attempt.chapter.title}` : ''}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-white mt-1" style={{ fontFamily: 'Poppins' }}>
            {attempt.title}
          </h1>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-sm">
            <Clock size={15} className="text-blue-400" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>
          <span className="text-xs text-slate-400">
            {answeredCount} of {totalQuestions} answered
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-1.5 bg-blue-500 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question Palette (Quick Jump) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = idx === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                isCurrent
                  ? 'border-2 border-blue-500 bg-blue-500/20 text-white'
                  : isAnswered
                  ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Main Question Card */}
      {currentQuestion && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
              Question {currentIdx + 1} of {totalQuestions}
            </span>
            {currentQuestion.difficulty && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                {currentQuestion.difficulty}
              </span>
            )}
          </div>

          <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
            {currentQuestion.questionText}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {optionsList.map(({ key, text }) => {
              const isSelected = answers[currentQuestion.id] === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectOption(key)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm shadow-blue-500/10'
                      : 'border-slate-800 bg-slate-900/30 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'border border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {key}
                  </span>
                  <span className="text-sm font-medium">{text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation & Submit Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => i - 1)}
          className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 flex items-center gap-1.5"
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <CheckCircle2 size={16} />
            Submit Test
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => i + 1)}
            className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            Next
            <ArrowRight size={16} />
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Poppins' }}>
              Confirm Test Submission
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              You have answered <span className="font-semibold text-blue-400">{answeredCount}</span> of{' '}
              <span className="font-semibold text-blue-400">{totalQuestions}</span> questions.
              {answeredCount < totalQuestions && (
                <span className="text-amber-400 block mt-2 font-medium">
                  Warning: You have {totalQuestions - answeredCount} unanswered question(s).
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              Once submitted, your answers will be scored on the server and your XP will be updated immediately.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
              >
                Keep Reviewing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

