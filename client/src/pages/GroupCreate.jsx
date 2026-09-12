import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function GroupCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', subject: '', privacy: 'PUBLIC' });
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/groups', form);
      showToast('Group created', 'success');
      navigate(`/groups/${res.data.data.group.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not create group', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6" style={{ fontFamily: 'Poppins' }}>Create a study group</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Group name</label>
          <input required className={inputClass} value={form.name} onChange={update('name')} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Subject</label>
          <input className={inputClass} value={form.subject} onChange={update('subject')} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Description</label>
          <textarea className={inputClass} rows={3} value={form.description} onChange={update('description')} />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Privacy</label>
          <select className={inputClass} value={form.privacy} onChange={update('privacy')}>
            <option value="PUBLIC">Public — anyone can join</option>
            <option value="PRIVATE">Private — requires a join code</option>
          </select>
        </div>
        <button disabled={submitting} className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg py-2.5 font-medium">
          {submitting ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </div>
  );
}
