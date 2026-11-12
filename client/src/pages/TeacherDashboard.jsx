import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  School,
  Users,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  Plus,
  Sparkles,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function TeacherDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => api.get('/teacher/dashboard').then((r) => r.data.data),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl max-w-6xl mx-auto" />;

  const stats = data?.stats || {};
  const classrooms = data?.classrooms || [];
  const recentSubmissions = data?.recentSubmissions || [];

  const cards = [
    { label: 'Active Classrooms', value: stats.totalClassrooms || 0, icon: School, color: 'text-indigo-400' },
    { label: 'Enrolled Students', value: stats.totalStudents || 0, icon: Users, color: 'text-sky-400' },
    { label: 'Published Quizzes', value: stats.publishedQuizzes || 0, icon: BookOpen, color: 'text-emerald-400' },
    { label: 'Pending Assessments', value: stats.pendingAssessments || 0, icon: ClipboardCheck, color: 'text-amber-400' },
    { label: 'Avg Class Score', value: `${stats.avgClassPerformance || 0}%`, icon: TrendingUp, color: 'text-rose-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[11px] font-bold">
            Educator Portal
          </span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: 'Poppins' }}>
            Welcome back, {user?.name || 'Educator'}
          </h1>
          <p className="text-xs text-slate-400">
            Manage your digital classrooms, generate curriculum or AI-powered quizzes, and track student progress.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/teacher/classrooms"
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Manage Classrooms
          </Link>
          <Link
            to="/teacher/quizzes/create"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
          >
            <Sparkles size={14} /> Create Quiz
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Classrooms */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <School size={16} className="text-indigo-400" /> Active Classrooms
            </h2>
            <Link to="/teacher/classrooms" className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {classrooms.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-slate-400">You have not created a classroom yet.</p>
              <Link
                to="/teacher/classrooms"
                className="inline-block px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
              >
                Create First Classroom
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {classrooms.map((c) => (
                <Link
                  key={c.id}
                  to={`/teacher/classrooms/${c.id}`}
                  className="p-3 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {c.subject || 'General'} {c.grade ? `• Class ${c.grade}` : ''} • Code:{' '}
                      <span className="font-mono text-indigo-400">{c.joinCode}</span>
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-400" /> Recent Student Submissions
            </h2>
            <Link to="/teacher/analytics" className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1">
              Full Analytics <ArrowRight size={12} />
            </Link>
          </div>

          {recentSubmissions.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No student quiz submissions recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recentSubmissions.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{s.user?.name || 'Student'}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {s.assignment?.quiz?.title || 'Quiz'} • {s.assignment?.classroom?.name || ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-400">
                      {s.score}/{s.totalQuestions} ({Math.round(s.percentage)}%)
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
