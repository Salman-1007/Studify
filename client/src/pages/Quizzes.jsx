import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Clock, BookOpen } from 'lucide-react';
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
      {/* Official Board Question Bank Feature Card */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/30 via-slate-900/60 to-slate-900/40 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Official Curriculum
            </span>
            <span className="text-xs text-slate-400">Class 9 & 10 · Punjab Textbook Board / PECTAA</span>
          </div>
          <h2 className="text-lg font-semibold text-white">Board Exam Question Bank & Chapter Tests</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Practice over 180+ verified MCQs covering Class 9 & 10 Physics and Chemistry chapters with real-time scoring and server-validated XP.
          </p>
        </div>
        <Link
          to="/question-bank"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 shrink-0 self-start md:self-auto"
        >
          <BookOpen size={16} />
          Explore Question Bank
        </Link>
      </div>

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
