import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function QuizTake() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(null);
  const autoSubmittedRef = useRef(false);

  const { data: standardQuiz, isLoading: loadingQuiz, error: quizError } = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => api.get(`/quizzes/${id}`).then((r) => r.data.data.quiz),
    enabled: !assignmentId,
  });

  const { data: assignmentData, isLoading: loadingAssignment, error: assignmentError } = useQuery({
    queryKey: ['classroom-assignment-attempt', assignmentId],
    queryFn: () => api.post(`/classrooms/assignments/${assignmentId}/start`, {}).then((r) => r.data.data),
    enabled: Boolean(assignmentId),
    retry: false,
  });

  const isLoading = assignmentId ? loadingAssignment : loadingQuiz;
  const error = assignmentId ? assignmentError : quizError;

  const quizTitle = assignmentId
    ? assignmentData?.assignment?.title || 'Classroom Quiz'
    : standardQuiz?.title;
  const instructions = assignmentId ? assignmentData?.assignment?.instructions : null;
  const questions = assignmentId
    ? assignmentData?.questions || []
    : standardQuiz?.questions || [];

  useEffect(() => {
    if (!assignmentId || !assignmentData?.assignment?.durationSecs || !assignmentData?.submission?.startedAt) {
      return;
    }
    const totalSecs = assignmentData.assignment.durationSecs;
    const elapsed = Math.floor(
      (Date.now() - new Date(assignmentData.submission.startedAt).getTime()) / 1000
    );
    setSecondsLeft(Math.max(0, totalSecs - elapsed));
  }, [assignmentId, assignmentData]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        timeTakenSecs: Math.round((Date.now() - startedAt) / 1000),
      };

      if (assignmentId) {
        const res = await api.post(`/classrooms/assignments/${assignmentId}/submit`, {
          ...payload,
          submissionId: assignmentData?.submission?.id,
        });
        const sub = res.data.data.submission;
        const normalizedState = {
          attempt: {
            score: sub.score,
            totalQuestions: sub.totalQuestions,
            percentage: sub.percentage,
            questionAttempts: (sub.answersSnapshot || []).map((a, idx) => ({
              id: a.questionId || idx,
              givenAnswer: a.givenAnswer,
              isCorrect: a.isCorrect,
              question: {
                question: a.question,
                correctAnswer: a.correctAnswer,
                explanation: a.explanation,
              },
            })),
          },
          pointsEarned: res.data.data.pointsEarned || 0,
          assignmentId,
          classroomId: assignmentData?.submission?.classroomId || null,
        };
        navigate(`/quizzes/${id}/results?assignmentId=${assignmentId}`, { state: normalizedState });
      } else {
        const res = await api.post(`/quizzes/${id}/attempt`, payload);
        navigate(`/quizzes/${id}/results`, { state: res.data.data });
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not submit quiz', 'error');
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (secondsLeft === null || submitting) return;
    if (secondsLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submit();
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timer);
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error) {
    return (
      <div className="max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 space-y-3">
        <h2 className="text-base font-bold text-rose-300">Unable to Start Assessment</h2>
        <p className="text-xs text-slate-300">
          {error.response?.data?.message || 'This assessment is unavailable or no longer accepting submissions.'}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!questions.length) {
    return <p className="text-sm text-slate-400">No questions found in this quiz.</p>;
  }

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const selectAnswer = (answer) => setAnswers((a) => ({ ...a, [question.id]: answer }));

  const formatSecs = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>{quizTitle}</h1>
          {instructions && <p className="text-xs text-slate-400 mt-0.5">{instructions}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {secondsLeft !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                secondsLeft < 60
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              }`}
            >
              <Clock size={12} />
              {formatSecs(secondsLeft)}
            </span>
          )}
          <span className="text-sm text-slate-400">{current + 1} / {questions.length}</span>
        </div>
      </div>

      <div className="w-full h-1.5 bg-slate-800 rounded-full mb-6">
        <div
          className="h-1.5 bg-blue-500 rounded-full transition-all"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="font-medium mb-4">{question.question}</p>
        <div className="space-y-2">
          {(question.options || ['True', 'False']).length > 0 && question.type !== 'FILL_BLANK' ? (
            (question.options || ['True', 'False']).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => selectAnswer(opt)}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm cursor-pointer ${
                  answers[question.id] === opt ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <input
              value={answers[question.id] || ''}
              onChange={(e) => selectAnswer(e.target.value)}
              placeholder="Type your answer"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm"
            />
          )}
        </div>
      </div>

      <div className="flex justify-between mt-4">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
          className="text-sm px-4 py-2 rounded-lg border border-slate-700 disabled:opacity-40 cursor-pointer"
        >
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="text-sm px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 font-medium text-white cursor-pointer"
          >
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => c + 1)}
            className="text-sm px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 font-medium text-white cursor-pointer"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
