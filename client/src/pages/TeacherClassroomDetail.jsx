import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Megaphone,
  BookOpen,
  Trophy,
  MessageSquare,
  Copy,
  RefreshCw,
  Pin,
  Trash2,
  UserMinus,
  Link2,
  Plus,
  BarChart3,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function TeacherClassroomDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('STUDENTS');
  const [annForm, setAnnForm] = useState({ title: '', content: '', isPinned: false, postToChat: true });
  const [inviteForm, setInviteForm] = useState({ email: '', expiresInDays: 14, maxUses: 50 });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-classroom-detail', id],
    queryFn: () => api.get(`/classrooms/${id}`).then((r) => r.data.data),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['teacher-classroom-invitations', id],
    queryFn: () => api.get(`/teacher/classrooms/${id}/invitations`).then((r) => r.data.data.invitations),
    enabled: tab === 'INVITES',
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['teacher-classroom-leaderboard', id],
    queryFn: () => api.get(`/classrooms/${id}/leaderboard`).then((r) => r.data.data.rankings),
    enabled: tab === 'LEADERBOARD',
  });

  const { data: assignmentReport } = useQuery({
    queryKey: ['teacher-assignment-detail', selectedAssignmentId],
    queryFn: () => api.get(`/teacher/assignments/${selectedAssignmentId}`).then((r) => r.data.data),
    enabled: Boolean(selectedAssignmentId),
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: () => api.post(`/teacher/classrooms/${id}/regenerate-code`, {}),
    onSuccess: () => {
      showToast('Join code regenerated', 'success');
      queryClient.invalidateQueries(['teacher-classroom-detail', id]);
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: (userId) => api.delete(`/teacher/classrooms/${id}/members/${userId}`),
    onSuccess: () => {
      showToast('Student removed from classroom & group chat', 'success');
      queryClient.invalidateQueries(['teacher-classroom-detail', id]);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to remove student', 'error'),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (payload) => api.post(`/teacher/classrooms/${id}/announcements`, payload),
    onSuccess: () => {
      showToast('Announcement published', 'success');
      setAnnForm({ title: '', content: '', isPinned: false, postToChat: true });
      queryClient.invalidateQueries(['teacher-classroom-detail', id]);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Could not post announcement', 'error'),
  });

  const togglePinAnnMutation = useMutation({
    mutationFn: (announcementId) => api.patch(`/teacher/classrooms/${id}/announcements/${announcementId}/pin`, {}),
    onSuccess: () => queryClient.invalidateQueries(['teacher-classroom-detail', id]),
  });

  const deleteAnnMutation = useMutation({
    mutationFn: (announcementId) => api.delete(`/teacher/classrooms/${id}/announcements/${announcementId}`),
    onSuccess: () => {
      showToast('Announcement deleted', 'success');
      queryClient.invalidateQueries(['teacher-classroom-detail', id]);
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (payload) => api.post(`/teacher/classrooms/${id}/invitations`, payload),
    onSuccess: () => {
      showToast('Invitation link created', 'success');
      setInviteForm({ email: '', expiresInDays: 14, maxUses: 50 });
      queryClient.invalidateQueries(['teacher-classroom-invitations', id]);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to create invite', 'error'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId) => api.patch(`/teacher/classrooms/${id}/invitations/${invitationId}/revoke`, {}),
    onSuccess: () => {
      showToast('Invitation revoked', 'success');
      queryClient.invalidateQueries(['teacher-classroom-invitations', id]);
    },
  });

  const updateAssignmentStatusMutation = useMutation({
    mutationFn: ({ assignmentId, status }) => api.patch(`/teacher/assignments/${assignmentId}/status`, { status }),
    onSuccess: () => {
      showToast('Assignment status updated', 'success');
      queryClient.invalidateQueries(['teacher-classroom-detail', id]);
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl max-w-6xl mx-auto" />;

  const { classroom, members = [], announcements = [], assignments = [] } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link to="/teacher/classrooms" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2">
            <ArrowLeft size={13} /> Manage Classrooms
          </Link>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            {classroom.name}
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
            <span>{classroom.subject || 'General'}</span>
            {classroom.grade && <span>• Class {classroom.grade}</span>}
            <span>• {members.length} enrolled</span>
            <span className="inline-flex items-center gap-1.5">
              • Join Code:
              <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-indigo-400 font-bold">
                {classroom.joinCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(classroom.joinCode);
                  showToast('Join code copied', 'success');
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                onClick={() => regenerateCodeMutation.mutate()}
                className="text-slate-400 hover:text-indigo-400 cursor-pointer"
                title="Regenerate join code"
              >
                <RefreshCw size={12} />
              </button>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {classroom.groupId && (
            <Link
              to={`/groups/${classroom.groupId}/chat`}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <MessageSquare size={14} /> Classroom Chat
            </Link>
          )}
          <Link
            to="/teacher/quizzes/create"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Build & Assign Quiz
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2">
        {[
          { key: 'STUDENTS', label: `Students (${members.length})`, icon: Users },
          { key: 'ASSIGNMENTS', label: `Assigned Quizzes (${assignments.length})`, icon: BookOpen },
          { key: 'ANNOUNCEMENTS', label: `Announcements (${announcements.length})`, icon: Megaphone },
          { key: 'INVITES', label: 'Invite Links', icon: Link2 },
          { key: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              tab === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'STUDENTS' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800">
          {members.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No students enrolled yet. Share join code <strong>{classroom.joinCode}</strong> or generate an invitation link.
            </div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-white text-sm">{m.user?.name}</p>
                  <p className="text-slate-400">
                    {m.user?.email} {m.user?.grade ? `• Class ${m.user.grade}` : ''} • Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove ${m.user?.name} from this classroom?`)) {
                      removeStudentMutation.mutate(m.userId);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-700 text-slate-300 hover:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserMinus size={13} /> Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'ASSIGNMENTS' && (
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No quizzes assigned to this classroom yet. Create a quiz and assign it here!
            </div>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white">{a.title || a.quiz?.title}</h3>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">
                      {a.status}
                    </span>
                  </div>
                  <p className="text-slate-400">
                    {a.submissionsCount || 0} submissions • Max attempts: {a.maxAttempts}
                    {a.deadline ? ` • Due ${new Date(a.deadline).toLocaleString()}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignmentId(a.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-indigo-500 text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 size={13} /> Analytics
                  </button>
                  {a.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => updateAssignmentStatusMutation.mutate({ assignmentId: a.id, status: 'CLOSED' })}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                  {a.status === 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => updateAssignmentStatusMutation.mutate({ assignmentId: a.id, status: 'ACTIVE' })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'ANNOUNCEMENTS' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAnnouncementMutation.mutate(annForm);
            }}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold text-white">Post Announcement</h3>
            <input
              value={annForm.title}
              onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
              placeholder="Title (optional)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
            <textarea
              required
              rows={3}
              value={annForm.content}
              onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
              placeholder="Share schedule updates, exam reminders, or revision guidance…"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-slate-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annForm.isPinned}
                    onChange={(e) => setAnnForm({ ...annForm, isPinned: e.target.checked })}
                  />
                  Pin announcement
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annForm.postToChat}
                    onChange={(e) => setAnnForm({ ...annForm, postToChat: e.target.checked })}
                  />
                  Also post to Classroom Chat
                </label>
              </div>
              <button
                type="submit"
                disabled={createAnnouncementMutation.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {createAnnouncementMutation.isPending ? 'Posting…' : 'Publish Announcement'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {ann.isPinned && <Pin size={13} className="text-indigo-400" />}
                    <h4 className="text-sm font-bold text-white">{ann.title || 'Announcement'}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePinAnnMutation.mutate(ann.id)}
                      className="text-slate-400 hover:text-indigo-400 cursor-pointer"
                      title={ann.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAnnMutation.mutate(ann.id)}
                      className="text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Delete announcement"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'INVITES' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createInviteMutation.mutate({
                email: inviteForm.email.trim() || undefined,
                expiresInDays: Number(inviteForm.expiresInDays) || 14,
                maxUses: inviteForm.maxUses ? Number(inviteForm.maxUses) : null,
              });
            }}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 grid sm:grid-cols-4 gap-3 text-xs items-end"
          >
            <div>
              <label className="block text-slate-400 mb-1">Restrict Email (optional)</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="student@school.edu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Max Uses</label>
              <input
                type="number"
                min={1}
                value={inviteForm.maxUses}
                onChange={(e) => setInviteForm({ ...inviteForm, maxUses: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Expires (Days)</label>
              <input
                type="number"
                min={1}
                value={inviteForm.expiresInDays}
                onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={createInviteMutation.isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
            >
              Generate Invite Link
            </button>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800">
            {invitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No invitation links generated yet.</div>
            ) : (
              invitations.map((inv) => {
                const inviteUrl = `${window.location.origin}/classrooms/join/${inv.token}`;
                return (
                  <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-indigo-400 font-mono truncate">{inviteUrl}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(inviteUrl);
                            showToast('Invite link copied!', 'success');
                          }}
                          className="text-slate-400 hover:text-white cursor-pointer shrink-0"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      <p className="text-slate-400">
                        {inv.email ? `Bound to ${inv.email}` : 'Open link'} • Uses: {inv.usedCount}/{inv.maxUses || '∞'}
                        {inv.isRevoked && <span className="ml-2 text-rose-400 font-semibold">• Revoked</span>}
                      </p>
                    </div>
                    {!inv.isRevoked && (
                      <button
                        type="button"
                        onClick={() => revokeInviteMutation.mutate(inv.id)}
                        className="px-3 py-1 rounded-lg border border-slate-700 hover:border-rose-700 text-slate-300 hover:text-rose-400 cursor-pointer shrink-0"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'LEADERBOARD' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800">
          {!leaderboard.length ? (
            <div className="p-8 text-center text-xs text-slate-400">No submissions recorded yet.</div>
          ) : (
            leaderboard.map((row) => (
              <div key={row.userId} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-indigo-400">
                    #{row.rank}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{row.name}</p>
                    <p className="text-slate-400">{row.quizzesCompleted} quizzes • {row.avgAccuracy}% avg</p>
                  </div>
                </div>
                <span className="font-bold text-emerald-400 text-sm">{row.totalScore} pts</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assignment Analytics Drawer/Modal */}
      {selectedAssignmentId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                {assignmentReport?.assignment?.title || 'Assignment Report'}
              </h3>
              <button type="button" onClick={() => setSelectedAssignmentId(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {assignmentReport ? (
              <div className="space-y-5 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-slate-400">Completed</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {assignmentReport.analytics.completedCount}/{assignmentReport.analytics.totalEnrolled}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-slate-400">Average Score</p>
                    <p className="text-lg font-bold text-indigo-400">{assignmentReport.analytics.avgPercentage}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <p className="text-slate-400">Pending</p>
                    <p className="text-lg font-bold text-amber-400">{assignmentReport.analytics.pendingCount}</p>
                  </div>
                </div>

                {assignmentReport.analytics.missedQuestions?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-200">Most Missed Questions</h4>
                    <div className="space-y-1.5">
                      {assignmentReport.analytics.missedQuestions.slice(0, 5).map((mq) => (
                        <div key={mq.questionId} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
                          <span className="text-slate-300 truncate">{mq.question}</span>
                          <span className="text-rose-400 font-bold shrink-0">{mq.missRate}% missed</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-200">Student Submissions</h4>
                  {assignmentReport.submissions?.length === 0 ? (
                    <p className="text-slate-500">No submissions yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                      {assignmentReport.submissions.map((s) => (
                        <div key={s.id} className="p-3 flex items-center justify-between bg-slate-950/40">
                          <div>
                            <p className="font-semibold text-white">{s.user?.name}</p>
                            <p className="text-[11px] text-slate-400">{s.user?.email} • {s.timeTakenSecs}s</p>
                          </div>
                          <span className="font-bold text-emerald-400">
                            {s.score}/{s.totalQuestions} ({Math.round(s.percentage)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Loading analytics…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
