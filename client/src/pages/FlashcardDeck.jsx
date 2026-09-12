import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';

export default function FlashcardDeck() {
  const { deckId } = useParams();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const { data: deck, isLoading } = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => api.get(`/flashcards/decks/${deckId}`).then((r) => r.data.data.deck),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (deck.cards.length === 0) {
    return <p className="text-slate-400">This deck has no cards yet.</p>;
  }

  const card = deck.cards[index % deck.cards.length];

  const rate = async (rating) => {
    await api.post(`/flashcards/cards/${card.id}/review`, { rating });
    qc.invalidateQueries({ queryKey: ['due-cards'] });
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <div className="max-w-lg">
      <Link to="/flashcards" className="text-sm text-slate-400 hover:text-slate-200">← Flashcards</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6" style={{ fontFamily: 'Poppins' }}>{deck.title}</h1>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 h-64 flex items-center justify-center px-8 text-center cursor-pointer select-none"
      >
        <p className="text-lg">{flipped ? card.back : card.front}</p>
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">Tap the card to flip it</p>

      {flipped && (
        <div className="flex justify-center gap-3 mt-5">
          <button onClick={() => rate('hard')} className="text-sm px-4 py-2 rounded-lg bg-red-500/20 text-red-300">Hard</button>
          <button onClick={() => rate('medium')} className="text-sm px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300">Medium</button>
          <button onClick={() => rate('easy')} className="text-sm px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300">Easy</button>
        </div>
      )}
    </div>
  );
}
