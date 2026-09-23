import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { Award, Flame, Zap, Shield, BookOpen, Mail } from 'lucide-react';

const SUPPORTED_CLASSES = [
  { value: '9', label: 'Class 9 (Matric 1)' },
  { value: '10', label: 'Class 10 (Matric 2)' },
  { value: '11', label: 'Class 11 (FSc 1)' },
  { value: '12', label: 'Class 12 (FSc 2)' },
];

const SUPPORTED_BOARDS = [
  { value: 'Punjab', label: 'Punjab Board' },
  { value: 'Federal/FBISE', label: 'Federal Board (FBISE)' },
  { value: 'Sindh', label: 'Sindh Board' },
  { value: 'KPK', label: 'KPK Board' },
];

export default function Profile() {
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/profile').then((r) => r.data.data),
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  const u = data.user;

  const startEdit = () => {
    setForm({
      name: u.name,
      class: u.class || u.grade || '9',
      board: u.board || 'Punjab',
      institution: u.institution || '',
    });
    setEditError('');
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const res = await api.put('/users/profile', {
        name: form.name,
        grade: form.class,
        class: form.class,
        board: form.board,
        institution: form.institution,
      });
      setUser((prev) => ({ ...prev, ...res.data.data.user }));
      await qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      setEditError(err.response?.data?.message || err.response?.data?.error?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header Info */}
      <div className="flex items-start sm:items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-bold border border-blue-500/30">
          {u.name ? u.name[0].toUpperCase() : 'S'}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-white" style={{ fontFamily: 'Poppins' }}>{u.name}</h1>
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
              Level {u.level || 1}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
            <span className="flex items-center gap-1"><Mail size={12} /> {u.email}</span>
            <span>·</span>
            <span>@{u.username}</span>
            <span>·</span>
            <span className="text-amber-400 font-medium">{u.xp || u.points || 0} XP</span>
          </div>
        </div>
        {!editing && (
          <button onClick={startEdit} className="text-xs sm:text-sm border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 font-medium transition-colors">
            Edit profile
          </button>
        )}
      </div>

      {/* Edit Form */}
      {editing && (
        <form onSubmit={save} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Edit Profile Information</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Full Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Class / Grade</label>
              <select className={inputClass} value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} required>
                {SUPPORTED_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Educational Board</label>
              <select className={inputClass} value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} required>
                {SUPPORTED_BOARDS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">School / College</label>
            <input className={inputClass} placeholder="e.g. Punjab College" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          </div>
          {editError && <p className="text-xs text-red-400">{editError}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={saving} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg px-4 py-2 text-sm font-medium text-white">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-2 text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Student Academic & Progress Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AcademicBadge icon={BookOpen} label="Class" value={`Class ${u.class || u.grade || '9'}`} accent="text-blue-400" />
        <AcademicBadge icon={Shield} label="Board" value={u.board || 'Punjab'} accent="text-emerald-400" />
        <AcademicBadge icon={Zap} label="Experience" value={`${u.xp || u.points || 0} XP`} accent="text-amber-400" />
        <AcademicBadge icon={Flame} label="Streak" value={`${u.streak || u.streakCount || 0}d`} accent="text-orange-400" />
      </div>

      {/* Quizzes & Activity Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Quizzes completed" value={data.stats.quizzesCompleted} />
        <Stat label="Average accuracy" value={`${data.stats.avgAccuracy}%`} />
        <Stat label="Current level" value={`Level ${u.level || 1}`} />
      </div>

      {/* Achievements */}
      <div>
        <h2 className="font-medium text-sm text-slate-200 mb-3">Achievements</h2>
        {data.achievements.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
            No achievements unlocked yet. Take quizzes and participate in study groups to earn badges.
          </div>
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

      {/* Study Groups */}
      <div>
        <h2 className="font-medium text-sm text-slate-200 mb-3">Study Groups</h2>
        {data.groups.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
            Not part of any study groups yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => (
              <span key={g.id} className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-full px-3 py-1">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AcademicBadge({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Icon size={14} className={accent} /> {label}
      </div>
      <p className="text-sm font-semibold text-slate-100 truncate">{value}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center">
      <p className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Poppins' }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
