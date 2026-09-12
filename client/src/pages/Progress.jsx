import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';

export default function Progress() {
  const { data, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get('/progress').then((r) => r.data.data),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Progress</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Quizzes completed" value={data.quizzesCompleted} />
        <Stat label="Average accuracy" value={`${data.avgAccuracy}%`} />
        <Stat label="Study streak" value={`${data.streakCount}d`} />
        <Stat label="Flashcard decks" value={data.flashcardDecks} />
      </div>

      <div>
        <h2 className="font-medium mb-3">Performance by subject</h2>
        {data.subjectPerformance.length === 0 ? (
          <p className="text-sm text-slate-400">Take some quizzes to see a breakdown here.</p>
        ) : (
          <div className="space-y-2">
            {data.subjectPerformance.map((s) => (
              <div key={s.subject}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{s.subject}</span>
                  <span className="text-slate-400">{s.avgPercentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${s.avgPercentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-3">Weak topics</h2>
        {data.weakTopics.length === 0 ? (
          <p className="text-sm text-slate-400">No weak topics identified yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.weakTopics.map((t) => (
              <span key={t} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 rounded-full px-3 py-1">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
