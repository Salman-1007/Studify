import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  School,
  KeyRound,
  Users,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function Classrooms() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [joinCode, setJoinCode] = useState('');

  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ['joined-classrooms'],
    queryFn: () => api.get('/classrooms/joined').then((r) => r.data.data.classrooms),
  });

  const { data: invitePreview, isLoading: loadingInvite } = useQuery({
    queryKey: ['classroom-invite-preview', token],
    queryFn: () => api.get(`/classrooms/invitations/${token}/preview`).then((r) => r.data.data.preview),
    enabled: Boolean(token),
    retry: false,
  });

  const joinByCodeMutation = useMutation({
    mutationFn: (code) => api.post('/classrooms/join-by-code', { joinCode: code }).then((r) => r.data.data),
    onSuccess: (data) => {
      showToast(`Joined ${data.classroom?.name || 'classroom'}!`, 'success');
      setJoinCode('');
      queryClient.invalidateQueries(['joined-classrooms']);
      if (data.classroom?.id) {
        navigate(`/classrooms/${data.classroom.id}`);
      }
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Invalid join code', 'error');
    },
  });

  const joinByInviteMutation = useMutation({
    mutationFn: (inviteToken) =>
      api.post(`/classrooms/invitations/${inviteToken}/join`, {}).then((r) => r.data.data),
    onSuccess: (data) => {
      showToast(`Enrolled in ${data.classroom?.name || 'classroom'}!`, 'success');
      queryClient.invalidateQueries(['joined-classrooms']);
      navigate(`/classrooms/${data.classroom.id}`);
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Could not join via invitation', 'error');
    },
  });

  if (isLoading) return <Skeleton className="h-80 rounded-2xl max-w-5xl mx-auto" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5" style={{ fontFamily: 'Poppins' }}>
            <School size={24} className="text-indigo-400" />
            My Classrooms
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Join educator-led classrooms, complete assigned quizzes, and collaborate in real-time class chats.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (joinCode.trim()) joinByCodeMutation.mutate(joinCode.trim());
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <KeyRound size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g. CLS-A1B2C3)"
              className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
          <button
            type="submit"
            disabled={!joinCode.trim() || joinByCodeMutation.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {joinByCodeMutation.isPending ? 'Joining…' : 'Join Class'}
          </button>
        </form>
      </div>

      {/* Invitation Preview Card when navigated to /classrooms/join/:token */}
      {token && (
        <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 space-y-3">
          {loadingInvite ? (
            <p className="text-xs text-slate-300">Loading classroom invitation…</p>
          ) : !invitePreview ? (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle size={16} />
              <span>Invitation link is invalid or unavailable.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Classroom Invitation Preview
                </span>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                  {invitePreview.name}
                </h2>
                <p className="text-xs text-slate-300">
                  Instructor: <strong>{invitePreview.teacher?.name}</strong>
                  {invitePreview.subject ? ` • ${invitePreview.subject}` : ''}
                  {invitePreview.grade ? ` • Class ${invitePreview.grade}` : ''}
                  {` • ${invitePreview.memberCount} students`}
                </p>
                {invitePreview.description && (
                  <p className="text-xs text-slate-400">{invitePreview.description}</p>
                )}
              </div>

              {invitePreview.alreadyMember ? (
                <Link
                  to={`/classrooms/${invitePreview.classroomId}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Already Enrolled — Open Class
                </Link>
              ) : invitePreview.isValid ? (
                <button
                  type="button"
                  disabled={joinByInviteMutation.isPending}
                  onClick={() => joinByInviteMutation.mutate(token)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {joinByInviteMutation.isPending ? 'Joining…' : 'Accept & Join Classroom'}
                </button>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-semibold">
                  {invitePreview.invalidReason || 'Invitation unavailable'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {classrooms.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <School size={36} className="mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-slate-200" style={{ fontFamily: 'Poppins' }}>
            You haven&apos;t joined any classrooms yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Ask your teacher for a classroom join code (e.g. CLS-XXXXXX) or an invitation link to get started.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((cls) => (
            <Link
              key={cls.id}
              to={`/classrooms/${cls.id}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-indigo-500/50 p-5 flex flex-col justify-between gap-4 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 text-[10px] font-bold">
                    {cls.subject || 'Classroom'}
                  </span>
                  {cls.grade && <span className="text-[11px] text-slate-400">Class {cls.grade}</span>}
                </div>
                <h2 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors" style={{ fontFamily: 'Poppins' }}>
                  {cls.name}
                </h2>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {cls.description || `Led by ${cls.teacher?.name || 'Educator'}`}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} /> {cls.memberCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={13} /> {cls.assignmentCount} quizzes
                  </span>
                </div>
                <ArrowRight size={14} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
