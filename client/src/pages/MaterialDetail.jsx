import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Sparkles, ListChecks, Layers } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);

  const { data: material, isLoading } = useQuery({
    queryKey: ['material', id],
    queryFn: () => api.get(`/materials/${id}`).then((r) => r.data.data.material),
  });

  const generateSummary = async () => {
    setLoadingAction('summary');
    try {
      const res = await api.post('/ai/summarize', { materialId: id });
      setSummary(res.data.data.summary);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate summary', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const generateQuiz = async () => {
    setLoadingAction('quiz');
    try {
      const res = await api.post('/ai/generate-quiz', { topic: material.title, materialId: id, numQuestions: 5, difficulty: 'MEDIUM' });
      showToast('Quiz generated', 'success');
      navigate(`/quizzes/${res.data.data.quiz.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate quiz', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const generateFlashcards = async () => {
    setLoadingAction('flashcards');
    try {
      const res = await api.post('/ai/generate-flashcards', { topic: material.title, materialId: id, numCards: 10 });
      showToast('Flashcards generated', 'success');
      navigate(`/flashcards/${res.data.data.deck.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate flashcards', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const chatAboutThis = async () => {
    navigate(`/mentor?material=${id}`);
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/materials" className="text-sm text-slate-400 hover:text-slate-200">← My Materials</Link>
        <h1 className="text-2xl font-semibold mt-2" style={{ fontFamily: 'Poppins' }}>{material.title}</h1>
        <p className="text-sm text-slate-500">{material.category || 'Uncategorized'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <ActionButton icon={Sparkles} label="Summarize" loading={loadingAction === 'summary'} onClick={generateSummary} />
        <ActionButton icon={ListChecks} label="Generate quiz" loading={loadingAction === 'quiz'} onClick={generateQuiz} />
        <ActionButton icon={Layers} label="Generate flashcards" loading={loadingAction === 'flashcards'} onClick={generateFlashcards} />
        <button onClick={chatAboutThis} className="text-sm border border-slate-700 hover:border-slate-500 rounded-lg px-4 py-2">
          Chat about this
        </button>
      </div>

      {summary && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}

      {!material.extractedText && (
        <p className="text-sm text-amber-400">No text could be extracted from this material yet — AI features may be limited.</p>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} className="flex items-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 disabled:opacity-60 border border-slate-700 rounded-lg px-4 py-2">
      <Icon size={15} /> {loading ? 'Working…' : label}
    </button>
  );
}
