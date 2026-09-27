import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function GroupQuizTake() {
  const { id, groupQuizId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(Date.now());
  const [timeLeftSecs, setTimeLeftSecs] = useState(600); // 10 mins default
  const hasAutoSubmitted = useRef(false);

  const { data: groupQuizzes, isLoading } = useQuery({
    queryKey: ['group-quizzes', id],
    queryFn: () => api.get(`/groups/${id}/quizzes`).then((r) => r.data.data.groupQuizzes),
  });
  const groupQuiz = groupQuizzes?.find((g) => g.id === groupQuizId);

  const { data: quiz, isLoading: quizLoading } = useQuery({
    queryKey: ['group-quiz-questions', groupQuiz?.quizId],
    queryFn: () => api.get(`/quizzes/${groupQuiz.quizId}`).then((r) => r.data.data.quiz),
    enabled: Boolean(groupQuiz),
  });

  // Calculate synchronized remaining time from groupQuiz.endedAt
  useEffect(() => {
    if (groupQuiz?.endedAt) {
      const remaining = Math.max(0, Math.floor((new Date(groupQuiz.endedAt).getTime() - Date.now()) / 1000));
      setTimeLeftSecs(remaining);
    }
  }, [groupQuiz]);

  const submitQuiz = useCallback(async () => {
    if (submitting || hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;
    setSubmitting(true);

    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        timeTakenSecs: Math.round((Date.now() - startedAt) / 1000),
      };
      await api.post(`/groups/${id}/quizzes/${groupQuizId}/submit`, payload);
      showToast('Quiz submitted! Check live results and standings 🏆', 'success');
      navigate(`/groups/${id}/quizzes/${groupQuizId}/leaderboard`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not submit quiz', 'error');
      navigate(`/groups/${id}/quizzes/${groupQuizId}/leaderboard`);
    } finally {
      setSubmitting(false);
    }
  }, [answers, startedAt, id, groupQuizId, submitting, navigate, showToast]);

  // Countdown timer ticker & auto-submit
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitQuiz]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!quiz?.questions?.length) return;
      const question = quiz.questions[current];

      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (question.options?.[idx]) {
          setAnswers((prev) => ({ ...prev, [question.id]: question.options[idx] }));
        }
      } else if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const map = { a: 0, b: 1, c: 2, d: 3 };
        const idx = map[e.key.toLowerCase()];
        if (question.options?.[idx]) {
          setAnswers((prev) => ({ ...prev, [question.id]: question.options[idx] }));
        }
      } else if (e.key === 'ArrowRight' && current < quiz.questions.length - 1) {
        setCurrent((c) => c + 1);
      } else if (e.key === 'ArrowLeft' && current > 0) {
        setCurrent((c) => c - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quiz, current]);

  if (isLoading || quizLoading || !quiz) return <Skeleton className="h-64" />;

  const question = quiz.questions[current];
  const isLast = current === quiz.questions.length - 1;
  const selectAnswer = (answer) => setAnswers((a) => ({ ...a, [question.id]: answer }));

  const minutes = Math.floor(timeLeftSecs / 60);
  const seconds = timeLeftSecs % 60;
  const timerWarning = timeLeftSecs < 120; // under 2 mins

  const progressPercent = Math.round(((current + 1) / quiz.questions.length) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/groups/${id}/quizzes`} className="text-xs font-semibold text-slate-400 hover:text-slate-200">
          ← Exit to Group Quizzes
        </Link>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${
          timerWarning ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-slate-800 text-slate-200'
        }`}>
          <Clock size={13} />
          <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
          {quiz.title}
        </h1>
        <span className="text-xs text-slate-400 font-medium">
          Question {current + 1} of {quiz.questions.length}
        </span>
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <p className="text-base text-slate-100 font-medium leading-relaxed">
          {question.question}
        </p>

        <div className="space-y-2.5 pt-2">
          {question.options && question.type !== 'FILL_BLANK' ? (
            question.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = answers[question.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectAnswer(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 text-blue-200 shadow-sm shadow-blue-500/10'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {letter}
                    </span>
                    <span>{opt}</span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-blue-400" />}
                </button>
              );
            })
          ) : (
            <input
              value={answers[question.id] || ''}
              onChange={(e) => selectAnswer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="Type your answer here…"
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
          className="text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 disabled:opacity-40 cursor-pointer"
        >
          Previous
        </button>

        <div className="text-[11px] text-slate-500 hidden sm:block">
          Use keys [1-4] or [A-D] to select, Arrow keys to navigate
        </div>

        {isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={submitQuiz}
            className="text-xs font-bold px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Submitting…' : 'Submit & Finish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => c + 1)}
            className="text-xs font-bold px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
