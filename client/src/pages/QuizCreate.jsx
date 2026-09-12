import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function QuizCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState({ topic: '', subject: '', difficulty: 'MEDIUM', numQuestions: 5 });
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/ai/generate-quiz', { ...form, numQuestions: Number(form.numQuestions) });
      showToast('Quiz generated', 'success');
      navigate(`/quizzes/${res.data.data.quiz.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate quiz — try again', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins' }}>Create an AI quiz</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Topic</label>
          <input required className={inputClass} value={form.topic} onChange={update('topic')} placeholder="e.g. Newton's Laws" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Subject (optional)</label>
          <input className={inputClass} value={form.subject} onChange={update('subject')} placeholder="e.g. Physics" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Difficulty</label>
            <select className={inputClass} value={form.difficulty} onChange={update('difficulty')}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Questions</label>
            <input type="number" min={1} max={20} className={inputClass} value={form.numQuestions} onChange={update('numQuestions')} />
          </div>
        </div>
        <button disabled={submitting} className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg py-2.5 font-medium">
          {submitting ? 'Generating…' : 'Generate quiz'}
        </button>
      </form>
    </div>
  );
}
