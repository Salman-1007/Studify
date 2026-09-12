import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Materials() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => api.get('/materials').then((r) => r.data.data.materials),
  });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', title);
      if (category) form.append('category', category);
      if (file) form.append('file', file);
      else if (text) form.append('text', text);
      await api.post('/materials', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Material added', 'success');
      setTitle(''); setCategory(''); setFile(null); setText(''); setShowForm(false);
      qc.invalidateQueries({ queryKey: ['materials'] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add material', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/materials/${id}`);
    qc.invalidateQueries({ queryKey: ['materials'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>My Materials</h1>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Add material
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
            <input placeholder="Category (e.g. Physics)" value={category} onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer">
              <Upload size={16} /> {file ? file.name : 'Upload PDF or text file'}
              <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
            </label>
            <span>or</span>
          </div>
          <textarea
            placeholder="Paste text content instead"
            value={text} onChange={(e) => setText(e.target.value)} rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm"
          />
          <button disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded-lg px-4 py-2 text-sm font-medium">
            {submitting ? 'Saving…' : 'Save material'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : materials.length === 0 ? (
        <EmptyState title="No materials yet" subtitle="Upload your syllabus or notes to unlock AI summaries, quizzes, and chat." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col">
              <FileText className="text-blue-400 mb-2" size={20} />
              <Link to={`/materials/${m.id}`} className="font-medium hover:text-blue-400">{m.title}</Link>
              <p className="text-xs text-slate-500 mt-1">{m.category || 'Uncategorized'}</p>
              <div className="flex-1" />
              <button onClick={() => remove(m.id)} className="self-end text-slate-500 hover:text-red-400 mt-3"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
