import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Edit3,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function TeacherQuizzes() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [assignQuiz, setAssignQuiz] = useState(null);
  const [assignForm, setAssignForm] = useState({
    classroomIds: [],
    title: '',
    instructions: '',
    deadline: '',
    durationMins: 15,
    maxAttempts: 1,
    randomizeQuestions: true,
    publishNow: true,
  });

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['teacher-quizzes'],
    queryFn: () => api.get('/teacher/quizzes').then((r) => r.data.data.quizzes),
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ['teacher-classrooms'],
    queryFn: () => api.get('/teacher/classrooms').then((r) => r.data.data.classrooms),
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (quizId) => api.delete(`/teacher/quizzes/${quizId}`),
    onSuccess: () => {
      showToast('Quiz deleted', 'success');
      queryClient.invalidateQueries(['teacher-quizzes']);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to delete quiz', 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ quizId, payload }) => api.post(`/teacher/quizzes/${quizId}/assign`, payload),
    onSuccess: (res) => {
      const count = res.data.data.assignments?.length || 1;
      showToast(`Quiz assigned to ${count} classroom${count > 1 ? 's' : ''}!`, 'success');
      setAssignQuiz(null);
      queryClient.invalidateQueries(['teacher-quizzes']);
      queryClient.invalidateQueries(['teacher-dashboard']);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to assign quiz', 'error'),
  });

  const openAssignModal = (quiz) => {
    setAssignQuiz(quiz);
    setAssignForm({
      classroomIds: classrooms.filter((c) => !c.isArchived).slice(0, 1).map((c) => c.id),
      title: quiz.title,
      instructions: '',
      deadline: '',
      durationMins: 15,
      maxAttempts: 1,
      randomizeQuestions: true,
      publishNow: true,
    });
  };

  const toggleClass = (clsId) => {
    setAssignForm((prev) => ({
      ...prev,
      classroomIds: prev.classroomIds.includes(clsId)
        ? prev.classroomIds.filter((x) => x !== clsId)
        : [...prev.classroomIds, clsId],
    }));
  };

  if (isLoading) return <Skeleton className="h-80 rounded-2xl max-w-6xl mx-auto" />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
            <BookOpen size={24} className="text-indigo-400" />
            Teacher Quiz Library
          </h1>
          <p className="text-xs text-slate-400">
            Review draft quizzes generated from question banks or lecture notes, edit MCQs, and assign to classrooms.
          </p>
        </div>

        <Link
          to="/teacher/quizzes/create"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
        >
          <Plus size={15} /> Create Quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <BookOpen size={36} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">No educator quizzes yet</h3>
          <p className="text-xs text-slate-400">
            Generate MCQs from the verified curriculum bank, upload PDF/DOCX/TXT notes, or write custom questions.
          </p>
          <Link
            to="/teacher/quizzes/create"
            className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            Build First Quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white">{q.title}</h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      q.status === 'PUBLISHED' || q.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {q.status || 'DRAFT'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                    {q.difficulty}
                  </span>
                </div>
                <p className="text-slate-400">
                  {q.subject || 'General'} • {q.topic} • {q.questions?.length || 0} questions • v{q.version || 1}
                  {q.assignments?.length > 0 && (
                    <span className="text-indigo-400 ml-2">
                      • Assigned to {q.assignments.length} classroom{q.assignments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/quizzes/create?quizId=${q.id}`)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  type="button"
                  disabled={!q.questions?.length}
                  onClick={() => openAssignModal(q)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={13} /> Assign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${q.title}"?`)) deleteQuizMutation.mutate(q.id);
                  }}
                  className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                  title="Delete quiz"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {assignQuiz && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                Assign Quiz to Classrooms
              </h3>
              <button type="button" onClick={() => setAssignQuiz(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignMutation.mutate({
                  quizId: assignQuiz.id,
                  payload: {
                    classroomIds: assignForm.classroomIds,
                    title: assignForm.title.trim() || assignQuiz.title,
                    instructions: assignForm.instructions.trim() || null,
                    deadline: assignForm.deadline ? new Date(assignForm.deadline).toISOString() : null,
                    durationSecs: assignForm.durationMins ? Number(assignForm.durationMins) * 60 : null,
                    maxAttempts: Number(assignForm.maxAttempts) || 1,
                    randomizeQuestions: Boolean(assignForm.randomizeQuestions),
                    publishNow: Boolean(assignForm.publishNow),
                  },
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Select Classrooms *</label>
                {classrooms.filter((c) => !c.isArchived).length === 0 ? (
                  <p className="text-amber-400">Create an active classroom first.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-slate-800 bg-slate-950/60">
                    {classrooms
                      .filter((c) => !c.isArchived)
                      .map((cls) => (
                        <label key={cls.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignForm.classroomIds.includes(cls.id)}
                            onChange={() => toggleClass(cls.id)}
                          />
                          <span className="text-slate-200 font-medium">{cls.name}</span>
                          <span className="text-slate-500">({cls.memberCount || 0} students)</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assignment Title</label>
                <input
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Instructions</label>
                <textarea
                  rows={2}
                  value={assignForm.instructions}
                  onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
                  placeholder="Optional guidelines for students…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={assignForm.durationMins}
                    onChange={(e) => setAssignForm({ ...assignForm, durationMins: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={assignForm.maxAttempts}
                    onChange={(e) => setAssignForm({ ...assignForm, maxAttempts: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Deadline</label>
                  <input
                    type="datetime-local"
                    value={assignForm.deadline}
                    onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1 text-slate-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.randomizeQuestions}
                    onChange={(e) => setAssignForm({ ...assignForm, randomizeQuestions: e.target.checked })}
                  />
                  Randomize question order
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.publishNow}
                    onChange={(e) => setAssignForm({ ...assignForm, publishNow: e.target.checked })}
                  />
                  Publish & notify students immediately
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignQuiz(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!assignForm.classroomIds.length || assignMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold cursor-pointer"
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
