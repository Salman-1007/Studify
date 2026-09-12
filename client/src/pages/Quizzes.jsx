import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Quizzes() {
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/quizzes').then((r) => r.data.data.quizzes),
  });
  const { data: attempts } = useQuery({
    queryKey: ['quiz-attempts'],
    queryFn: () => api.get('/quiz-attempts').then((r) => r.data.data.attempts),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Quizzes</h1>
        <Link to="/quizzes/create" className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Create AI quiz
        </Link>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : quizzes.length === 0 ? (
        <EmptyState title="No quizzes yet" subtitle="Generate one from a topic or a material to get started." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((q) => (
            <Link key={q.id} to={`/quizzes/${q.id}`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4">
              <p className="font-medium">{q.title}</p>
              <p className="text-xs text-slate-500 mt-1">{q.topic} · {q.difficulty} · {q._count.questions} questions</p>
            </Link>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-medium mb-3">Quiz history</h2>
        {!attempts || attempts.length === 0 ? (
          <p className="text-sm text-slate-400">No attempts yet.</p>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p>{a.quiz.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Clock size={11} /> {new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-medium ${a.percentage >= 80 ? 'text-emerald-400' : a.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {Math.round(a.percentage)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
