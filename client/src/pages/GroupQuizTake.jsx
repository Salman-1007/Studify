import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

  if (isLoading || quizLoading || !quiz) return <Skeleton className="h-64" />;

  const question = quiz.questions[current];
  const isLast = current === quiz.questions.length - 1;
  const selectAnswer = (answer) => setAnswers((a) => ({ ...a, [question.id]: answer }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        timeTakenSecs: Math.round((Date.now() - startedAt) / 1000),
      };
      await api.post(`/groups/${id}/quizzes/${groupQuizId}/submit`, payload);
      showToast('Submitted — check the leaderboard', 'success');
      navigate(`/groups/${id}/quizzes/${groupQuizId}/leaderboard`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <Link to={`/groups/${id}/quizzes`} className="text-sm text-slate-400 hover:text-slate-200">← Group quizzes</Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <h1 className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>{quiz.title}</h1>
        <span className="text-sm text-slate-400">{current + 1} / {quiz.questions.length}</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <p className="font-medium mb-4">{question.question}</p>
        <div className="space-y-2">
          {question.options && question.type !== 'FILL_BLANK' ? (
            question.options.map((opt) => (
              <button key={opt} onClick={() => selectAnswer(opt)}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm ${answers[question.id] === opt ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                {opt}
              </button>
            ))
          ) : (
            <input value={answers[question.id] || ''} onChange={(e) => selectAnswer(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" placeholder="Type your answer" />
          )}
        </div>
      </div>
      <div className="flex justify-between mt-4">
        <button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)} className="text-sm px-4 py-2 rounded-lg border border-slate-700 disabled:opacity-40">Back</button>
        {isLast ? (
          <button disabled={submitting} onClick={submit} className="text-sm px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 font-medium">
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        ) : (
          <button onClick={() => setCurrent((c) => c + 1)} className="text-sm px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 font-medium">Next</button>
        )}
      </div>
    </div>
  );
}
