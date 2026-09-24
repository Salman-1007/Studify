import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import {
  Award,
  Flame,
  Zap,
  Shield,
  BookOpen,
  Mail,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Layers,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
} from 'lucide-react';

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

  if (isLoading || !data) return <Skeleton className="h-96 max-w-4xl mx-auto rounded-2xl" />;

  const u = data.user;
  const stats = data.stats || {};
  const weakTopics = data.weakTopics || [];
  const masteredTopics = data.masteredTopics || [];
  const recentActivity = data.recentActivity || [];

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

  const inputClass =
    'w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Info & Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/20 shrink-0">
              {u.name ? u.name[0].toUpperCase() : 'S'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
                  {u.name}
                </h1>
                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  Level {stats.dynamicLevel || u.level || 1}
                </span>
                {u.role === 'ADMIN' && (
                  <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Mail size={12} /> {u.email}
                </span>
                <span>•</span>
                <span>@{u.username}</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{u.xp || u.points || 0} XP</span>
              </div>
            </div>
          </div>

          {!editing && (
            <button
              onClick={startEdit}
              className="text-xs sm:text-sm border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 rounded-xl px-4 py-2 font-semibold transition-all cursor-pointer self-start sm:self-auto"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <Sparkles size={14} /> Level {stats.dynamicLevel || 1}
            </span>
            <span>
              {stats.levelProgress || 0} / 100 XP to Level {(stats.dynamicLevel || 1) + 1}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${stats.levelProgress || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <form onSubmit={save} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 animate-in fade-in">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Edit Academic Profile
          </h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Full Name</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Class / Grade</label>
              <select
                className={inputClass}
                value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}
                required
              >
                {SUPPORTED_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Educational Board</label>
              <select
                className={inputClass}
                value={form.board}
                onChange={(e) => setForm({ ...form, board: e.target.value })}
                required
              >
                {SUPPORTED_BOARDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">School / College</label>
            <input
              className={inputClass}
              placeholder="e.g. Punjab Group of Colleges"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
            />
          </div>
          {editError && <p className="text-xs text-rose-400">{editError}</p>}
          <div className="flex gap-2.5 pt-2">
            <button
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-semibold px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Student Academic & Progress Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <AcademicBadge
          icon={BookOpen}
          label="Class"
          value={`Class ${u.class || u.grade || '9'}`}
          accent="text-blue-400"
        />
        <AcademicBadge
          icon={Shield}
          label="Board"
          value={u.board || 'Punjab Board'}
          accent="text-emerald-400"
        />
        <AcademicBadge
          icon={Zap}
          label="Experience"
          value={`${u.xp || u.points || 0} XP`}
          accent="text-amber-400"
        />
        <AcademicBadge
          icon={Flame}
          label="Streak"
          value={`${u.streak || u.streakCount || 0} Days`}
          accent="text-orange-400"
        />
      </div>

      {/* Dynamic Key Performance Metrics */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          Academic Performance Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Stat
            label="Total Tests & Quizzes"
            value={stats.quizzesCompleted || 0}
            sub={`${stats.standardTestsCount || 0} tests • ${stats.customQuizzesCount || 0} quizzes`}
          />
          <Stat
            label="Overall Accuracy"
            value={`${stats.avgAccuracy || 0}%`}
            sub={`${stats.totalQuestionsCorrect || 0}/${stats.totalQuestionsAttempted || 0} correct`}
            color={
              stats.avgAccuracy >= 80
                ? 'text-emerald-400'
                : stats.avgAccuracy >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
            }
          />
          <Stat
            label="Questions Solved"
            value={stats.totalQuestionsAttempted || 0}
            sub="Across all topics"
          />
          <Stat
            label="Flashcards Studied"
            value={stats.flashcardDecksCount || 0}
            sub={`${stats.flashcardReviewsCount || 0} reviews`}
          />
        </div>
      </div>

      {/* Weak Topics & Revision Targets Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Poppins' }}>
              Identified Weak Topics & Focus Areas
            </h2>
          </div>
          <span className="text-xs text-slate-400">Adaptive AI Tracking</span>
        </div>

        {weakTopics.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-xs text-emerald-300">
            <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-1.5" />
            <p className="font-semibold">No weak topics detected!</p>
            <p className="text-slate-400 mt-0.5">
              Your test accuracy is strong across all chapters. Take more practice tests to maintain exam readiness.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3.5">
            {weakTopics.map((t, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-sm">{t.topic}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {t.accuracy}% Accuracy
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t.correctCount}/{t.totalCount} correct • Subject: {t.subject}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-amber-300 font-medium">Needs revision</span>
                  <Link
                    to="/question-bank"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>Practice Drill</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mastered Topics */}
      {masteredTopics.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Poppins' }}>
              Mastered Topics ({masteredTopics.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {masteredTopics.map((m, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
              >
                <CheckCircle2 size={12} className="text-emerald-400" />
                {m.topic} ({m.accuracy}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Test & Quiz Activity */}
      {recentActivity.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
          <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'Poppins' }}>
            Recent Activity
          </h2>
          <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden bg-slate-950/40">
            {recentActivity.map((item, idx) => (
              <Link
                key={idx}
                to={item.url}
                className="p-3.5 flex items-center justify-between text-xs sm:text-sm hover:bg-slate-900/60 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} />
                    {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'} • {item.type}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${
                      item.percentage >= 80
                        ? 'text-emerald-400'
                        : item.percentage >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {item.percentage}%
                  </span>
                  <p className="text-[10px] text-slate-500">
                    {item.score}/{item.totalQuestions}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div>
        <h2 className="font-bold text-base text-white mb-3" style={{ fontFamily: 'Poppins' }}>
          Unlocked Achievements
        </h2>
        {data.achievements?.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-400">
            No achievements unlocked yet. Take tests, practice quizzes, and join study groups to unlock badges!
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.achievements?.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Award size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{a.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Study Groups */}
      <div>
        <h2 className="font-bold text-base text-white mb-3" style={{ fontFamily: 'Poppins' }}>
          Study Groups ({data.groups?.length || 0})
        </h2>
        {data.groups?.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-400">
            Not part of any study groups yet.{' '}
            <Link to="/groups" className="text-blue-400 font-semibold hover:underline">
              Browse study groups
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.groups?.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-3.5 py-1.5 font-medium transition-colors"
              >
                {g.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AcademicBadge({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Icon size={14} className={accent} /> {label}
      </div>
      <p className="text-sm font-bold text-slate-100 truncate">{value}</p>
    </div>
  );
}

function Stat({ label, value, sub, color = 'text-slate-100' }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 text-center flex flex-col justify-between">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`} style={{ fontFamily: 'Poppins' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}
