import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Megaphone,
  BookOpen,
  Trophy,
  MessageSquare,
  Pin,
  Clock,
  Play,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function ClassroomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState('QUIZZES');

  const { data, isLoading, error } = useQuery({
    queryKey: ['classroom-detail', id],
    queryFn: () => api.get(`/classrooms/${id}`).then((r) => r.data.data),
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ['classroom-leaderboard', id],
    queryFn: () => api.get(`/classrooms/${id}/leaderboard`).then((r) => r.data.data.rankings),
    enabled: tab === 'LEADERBOARD',
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/classrooms/${id}/leave`, {}),
    onSuccess: () => {
      showToast('Left classroom', 'success');
      navigate('/classrooms');
    },
    onError: (err) => showToast(err.response?.data?.message || 'Could not leave classroom', 'error'),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl max-w-5xl mx-auto" />;
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-3">
        <p className="text-sm text-rose-400">
          {error?.response?.data?.message || 'Could not load classroom'}
        </p>
        <Link to="/classrooms" className="text-xs text-indigo-400 hover:underline">
          Back to Classrooms
        </Link>
      </div>
    );
  }

  const { classroom, announcements = [], assignments = [] } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link
            to="/classrooms"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2"
          >
            <ArrowLeft size={13} /> My Classrooms
          </Link>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            {classroom.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Instructor: <strong>{classroom.teacher?.name}</strong>
            {classroom.subject ? ` • ${classroom.subject}` : ''}
            {classroom.grade ? ` • Class ${classroom.grade}` : ''}
            {` • ${classroom.memberCount} students`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {classroom.groupId && (
            <Link
              to={`/groups/${classroom.groupId}/chat`}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <MessageSquare size={14} /> Class Chat
            </Link>
          )}
          {!classroom.isOwner && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Leave this classroom?')) leaveMutation.mutate();
              }}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={13} /> Leave
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { key: 'QUIZZES', label: `Quizzes (${assignments.length})`, icon: BookOpen },
          { key: 'ANNOUNCEMENTS', label: `Announcements (${announcements.length})`, icon: Megaphone },
          { key: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'QUIZZES' && (
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No quizzes have been assigned in this classroom yet.
            </div>
          ) : (
            assignments.map((a) => {
              const expired = a.deadline && new Date(a.deadline) < new Date();
              const attemptsExhausted = (a.myAttemptsUsed || 0) >= (a.maxAttempts || 1);
              const canAttempt = ['PUBLISHED', 'ACTIVE'].includes(a.status) && !expired && !attemptsExhausted;

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{a.title || a.quiz?.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300">
                        {a.quiz?.difficulty || 'MEDIUM'}
                      </span>
                      {a.myBestSubmission && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 size={11} /> Best: {Math.round(a.myBestSubmission.percentage)}%
                        </span>
                      )}
                    </div>
                    {a.instructions && <p className="text-xs text-slate-400">{a.instructions}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span>{a.questionCount || 0} questions</span>
                      <span>•</span>
                      <span>
                        Attempts: {a.myAttemptsUsed || 0}/{a.maxAttempts || 1}
                      </span>
                      {a.durationSecs && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={11} /> {Math.round(a.durationSecs / 60)} min
                          </span>
                        </>
                      )}
                      {a.deadline && (
                        <>
                          <span>•</span>
                          <span className={expired ? 'text-rose-400' : ''}>
                            Due {new Date(a.deadline).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    {canAttempt ? (
                      <Link
                        to={`/quizzes/${a.quizId}?assignmentId=${a.id}`}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Play size={13} /> {a.myAttemptsUsed > 0 ? 'Retake Quiz' : 'Start Quiz'}
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium">
                        {attemptsExhausted
                          ? 'Completed'
                          : expired
                          ? 'Deadline Passed'
                          : a.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'ANNOUNCEMENTS' && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No announcements posted yet.
            </div>
          ) : (
            announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {ann.isPinned && <Pin size={13} className="text-indigo-400" />}
                    <h3 className="text-sm font-bold text-white">
                      {ann.title || 'Classroom Announcement'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(ann.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {ann.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'LEADERBOARD' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800">
          {!leaderboardData?.length ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No quiz submissions recorded in this classroom yet.
            </div>
          ) : (
            leaderboardData.map((row) => (
              <div key={row.userId} className="p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-indigo-400">
                    #{row.rank}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{row.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {row.quizzesCompleted} quizzes • {row.avgAccuracy}% accuracy
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400 text-sm">{row.totalScore} pts</p>
                  <p className="text-[11px] text-slate-500">{row.totalTimeTakenSecs}s total</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
