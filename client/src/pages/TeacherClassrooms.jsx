import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  School,
  Plus,
  Copy,
  Users,
  BookOpen,
  Archive,
  ArrowRight,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function TeacherClassrooms() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', grade: '', description: '' });

  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ['teacher-classrooms'],
    queryFn: () => api.get('/teacher/classrooms').then((r) => r.data.data.classrooms),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/teacher/classrooms', payload),
    onSuccess: () => {
      showToast('Classroom created with live group chat!', 'success');
      setModalOpen(false);
      setForm({ name: '', subject: '', grade: '', description: '' });
      queryClient.invalidateQueries(['teacher-classrooms']);
      queryClient.invalidateQueries(['teacher-dashboard']);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to create classroom', 'error'),
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: ({ id, isArchived }) => api.patch(`/teacher/classrooms/${id}`, { isArchived }),
    onSuccess: (_, vars) => {
      showToast(vars.isArchived ? 'Classroom archived' : 'Classroom restored', 'success');
      queryClient.invalidateQueries(['teacher-classrooms']);
    },
  });

  if (isLoading) return <Skeleton className="h-80 rounded-2xl max-w-6xl mx-auto" />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
            <School size={24} className="text-indigo-400" />
            Manage Classrooms
          </h1>
          <p className="text-xs text-slate-400">
            Create classes, share join codes or invite links, and manage enrolled students.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <Plus size={15} /> New Classroom
        </button>
      </div>

      {classrooms.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <School size={36} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">No classrooms yet</h3>
          <p className="text-xs text-slate-400">
            Create your first digital classroom to invite students and assign quizzes.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((cls) => (
            <div
              key={cls.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
                cls.isArchived
                  ? 'border-slate-800/60 bg-slate-900/20 opacity-75'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">
                    {cls.subject || 'General'}
                  </span>
                  {cls.isArchived ? (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                      Archived
                    </span>
                  ) : (
                    cls.grade && <span className="text-[11px] text-slate-400">Class {cls.grade}</span>
                  )}
                </div>

                <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                  {cls.name}
                </h2>
                {cls.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{cls.description}</p>
                )}

                <div className="pt-1 flex items-center gap-2 text-xs">
                  <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-indigo-400 font-bold">
                    {cls.joinCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(cls.joinCode);
                      showToast('Join code copied!', 'success');
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Copy join code"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} /> {cls.memberCount || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={13} /> {cls.assignmentCount || 0}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleArchiveMutation.mutate({ id: cls.id, isArchived: !cls.isArchived })
                    }
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title={cls.isArchived ? 'Restore classroom' : 'Archive classroom'}
                  >
                    <Archive size={13} />
                  </button>
                  <Link
                    to={`/teacher/classrooms/${cls.id}`}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold inline-flex items-center gap-1"
                  >
                    Open <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                Create Classroom
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(form);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-medium mb-1">Classroom Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Physics Class 9 — Morning Batch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Subject</label>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Physics"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Grade / Section</label>
                  <input
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="9-A"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Weekly quizzes, lab notes, and live Q&A."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
