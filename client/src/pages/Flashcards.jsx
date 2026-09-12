import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Flashcards() {
  const { data: decks, isLoading } = useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get('/flashcards/decks').then((r) => r.data.data.decks),
  });
  const { data: due } = useQuery({
    queryKey: ['due-cards'],
    queryFn: () => api.get('/flashcards/due').then((r) => r.data.data.cards),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Flashcards</h1>
        <p className="text-sm text-slate-400">{due?.length || 0} cards due for review</p>
      </div>
      <p className="text-sm text-slate-500">Generate a deck from your materials or via the AI Mentor's summarization feature.</p>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : decks.length === 0 ? (
        <EmptyState title="No flashcard decks yet" subtitle="Open a material and generate flashcards to see them here." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((d) => (
            <Link key={d.id} to={`/flashcards/${d.id}`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4">
              <Layers className="text-amber-400 mb-2" size={18} />
              <p className="font-medium">{d.title}</p>
              <p className="text-xs text-slate-500 mt-1">{d._count.cards} cards</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
