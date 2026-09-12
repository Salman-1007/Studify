import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { Award } from 'lucide-react';

export default function Profile() {
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/profile').then((r) => r.data.data),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  const startEdit = () => { setForm(data.user); setEditing(true); };

  const save = async (e) => {
    e.preventDefault();
    const res = await api.put('/users/profile', form);
    setUser((u) => ({ ...u, ...res.data.data.user }));
    qc.invalidateQueries({ queryKey: ['profile'] });
    setEditing(false);
    showToast('Profile updated', 'success');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-medium">
          {data.user.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>{data.user.name}</h1>
          <p className="text-sm text-slate-400">@{data.user.username} · {data.user.points} points</p>
        </div>
        <button onClick={startEdit} className="ml-auto text-sm border border-slate-700 rounded-lg px-4 py-2">Edit profile</button>
      </div>

      {editing && (
        <form onSubmit={save} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Institution" value={form.institution || ''} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Grade/Class" value={form.grade || ''} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <div className="flex gap-2">
            <button className="bg-blue-500 hover:bg-blue-600 rounded-lg px-4 py-2 text-sm font-medium">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Quizzes" value={data.stats.quizzesCompleted} />
        <Stat label="Avg accuracy" value={`${data.stats.avgAccuracy}%`} />
        <Stat label="Streak" value={`${data.user.streakCount}d`} />
      </div>

      <div>
        <h2 className="font-medium mb-3">Achievements</h2>
        {data.achievements.length === 0 ? (
          <p className="text-sm text-slate-400">Complete quizzes and join groups to earn badges.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.achievements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <Award className="text-amber-400 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-3">Groups</h2>
        {data.groups.length === 0 ? (
          <p className="text-sm text-slate-400">Not part of any groups yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => <span key={g.id} className="text-xs bg-slate-800 rounded-full px-3 py-1">{g.name}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center">
      <p className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
