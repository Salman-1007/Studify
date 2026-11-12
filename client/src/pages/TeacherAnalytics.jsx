import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, School, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';

export default function TeacherAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-analytics'],
    queryFn: () => api.get('/teacher/analytics').then((r) => r.data.data),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-2xl max-w-6xl mx-auto" />;

  const classroomStats = data?.classroomStats || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Poppins' }}>
          <BarChart3 size={24} className="text-indigo-400" />
          Educator Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Compare classroom participation, completion rates, and average assessment performance across your classes.
        </p>
      </div>

      {classroomStats.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400">
          Create a classroom and assign quizzes to view real-time performance analytics here.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {classroomStats.map((cls) => (
            <div
              key={cls.classroomId}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <School size={16} className="text-indigo-400" /> {cls.name}
                  </h2>
                  <p className="text-slate-400">{cls.subject || 'General'}</p>
                </div>
                <Link
                  to={`/teacher/classrooms/${cls.classroomId}`}
                  className="text-indigo-400 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  Open <ArrowRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-slate-400 flex items-center gap-1"><Users size={11} /> Students</p>
                  <p className="text-lg font-bold text-white mt-0.5">{cls.memberCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-slate-400 flex items-center gap-1"><CheckCircle2 size={11} /> Completion</p>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">{cls.completionRate}%</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-slate-400">Avg Score</p>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{cls.avgScore}%</p>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-2 bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, cls.avgScore)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {cls.assignmentsCount} assignments • {cls.submissionsCount} total submissions
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
