import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Clock, Trophy, AlertCircle, CheckCircle2, Award, Sparkles, BookOpen, Layers } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function GroupQuizzes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [sourceType, setSourceType] = useState('questionBank'); // 'questionBank' | 'myQuizzes'
  const [selectedSubject, setSelectedSubject] = useState('PHY9');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [quizId, setQuizId] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [startTiming, setStartTiming] = useState(0); // 0 = immediately, 120 = 2 mins, 300 = 5 mins
  const [submitting, setSubmitting] = useState(false);
  const [tabFilter, setTabFilter] = useState('all'); // 'all' | 'active' | 'completed'

  const { data: groupQuizzes = [], isLoading } = useQuery({
    queryKey: ['group-quizzes', id],
    queryFn: () => api.get(`/groups/${id}/quizzes`).then((r) => r.data.data.groupQuizzes),
    refetchInterval: 6000,
  });

  const { data: myQuizzes = [] } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/quizzes').then((r) => r.data.data.quizzes),
  });

  // Query syllabus subjects & chapters for Question Bank option
  const { data: subjects = [] } = useQuery({
    queryKey: ['curriculum-subjects'],
    queryFn: () => api.get('/curriculum/subjects').then((r) => r.data.data.subjects || []),
  });

  const currentSubjectObj = subjects.find((s) => s.code === selectedSubject || s.id === selectedSubject);

  useEffect(() => {
    if (currentSubjectObj?.chapters?.length > 0 && !selectedChapter) {
      setSelectedChapter(currentSubjectObj.chapters[0].id);
    }
  }, [currentSubjectObj, selectedChapter]);

  const hostCompetition = async () => {
    setSubmitting(true);
    try {
      const payload = {
        durationMinutes: Number(durationMinutes) || 10,
        startDelaySecs: Number(startTiming) || 0,
      };

      if (sourceType === 'questionBank') {
        payload.chapterId = selectedChapter;
        payload.subjectId = currentSubjectObj?.id;
        payload.title = quizTitle.trim() || `${currentSubjectObj?.bookName || 'Punjab Board'} Competition`;
      } else {
        if (!quizId) {
          showToast('Please select a quiz to host', 'error');
          setSubmitting(false);
          return;
        }
        payload.quizId = quizId;
      }

      await api.post(`/groups/${id}/quizzes`, payload);
      showToast('Group quiz competition created!', 'success');
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['group-quizzes', id] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not host competition', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startQuizNow = async (gqId) => {
    try {
      await api.post(`/groups/${id}/quizzes/${gqId}/start`, { durationMinutes });
      showToast('Quiz started! Live in chat.', 'success');
      qc.invalidateQueries({ queryKey: ['group-quizzes', id] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not start quiz', 'error');
    }
  };

  const endAndAnnounce = async (gqId) => {
    if (!window.confirm('Conclude this quiz competition and announce final results to group chat?')) return;
    try {
      const res = await api.post(`/groups/${id}/quizzes/${gqId}/end`);
      showToast('Competition ended! Results announced in Group Chat 🏆', 'success');
      qc.invalidateQueries({ queryKey: ['group-quizzes', id] });
      navigate(`/groups/${id}/quizzes/${gqId}/leaderboard`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to conclude quiz', 'error');
    }
  };

  const joinAndTake = async (gqId) => {
    try {
      await api.post(`/groups/${id}/quizzes/${gqId}/join`);
      navigate(`/groups/${id}/quizzes/${gqId}/take`);
    } catch (err) {
      navigate(`/groups/${id}/quizzes/${gqId}/take`);
    }
  };

  const filteredQuizzes = groupQuizzes.filter((gq) => {
    if (tabFilter === 'active') return gq.status === 'active' || gq.status === 'countdown';
    if (tabFilter === 'completed') return gq.status === 'completed';
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/groups/${id}`} className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">
          ← Back to Group Overview
        </Link>
        <Link to={`/groups/${id}/chat`} className="text-xs font-semibold text-blue-400 hover:text-blue-300">
          Open Live Chat →
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            Group Quiz Competitions
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Challenge classmates to timed tests, climb the group podium, and announce top scorers in chat.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center gap-2 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl px-4 py-2.5 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus size={16} /> Host a Group Quiz
        </button>
      </div>

      {/* Host Competition Modal / Panel */}
      {showCreate && (
        <div className="rounded-2xl border border-blue-500/30 bg-slate-900/90 p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-blue-400" /> Host a New Quiz Competition
            </h2>
            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>

          {/* Source Tabs */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setSourceType('questionBank')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                sourceType === 'questionBank' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen size={14} /> Punjab Textbook Bank
            </button>
            <button
              type="button"
              onClick={() => setSourceType('myQuizzes')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                sourceType === 'myQuizzes' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={14} /> My Custom Quizzes
            </button>
          </div>

          {sourceType === 'questionBank' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedChapter('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.code || s.id}>
                      Class {s.classGrade} · {s.bookName || s.subjectName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Chapter</label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {currentSubjectObj?.chapters?.map((chap) => (
                    <option key={chap.id} value={chap.id}>
                      Ch {chap.chapterNumber}: {chap.chapterName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Choose Quiz</label>
              <select
                value={quizId}
                onChange={(e) => setQuizId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select one of your created quizzes…</option>
                {myQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.difficulty} · {q.questions?.length || 5} questions)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Duration & Start Timer */}
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Quiz Time Limit</label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                      durationMinutes === mins
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-semibold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {mins} Mins
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Start Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Now', secs: 0 },
                  { label: 'In 2 min', secs: 120 },
                  { label: 'In 5 min', secs: 300 },
                ].map((timing) => (
                  <button
                    key={timing.secs}
                    type="button"
                    onClick={() => setStartTiming(timing.secs)}
                    className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                      startTiming === timing.secs
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 font-semibold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {timing.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={hostCompetition}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Setting up…' : 'Launch Competition'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'all', label: `All (${groupQuizzes.length})` },
          { id: 'active', label: 'Live & Scheduled' },
          { id: 'completed', label: 'Completed Results' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTabFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tabFilter === tab.id ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quizzes List */}
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : filteredQuizzes.length === 0 ? (
        <EmptyState
          title="No competitions match this view"
          subtitle="Any group member can initiate a competition using the button above."
        />
      ) : (
        <div className="space-y-4">
          {filteredQuizzes.map((gq) => {
            const isLive = gq.status === 'active';
            const isCountdown = gq.status === 'countdown';
            const isCompleted = gq.status === 'completed';
            const topParticipant = gq.participants?.[0];

            return (
              <div
                key={gq.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                  isLive
                    ? 'border-emerald-500/40 bg-gradient-to-r from-slate-900 to-emerald-950/20 shadow-lg shadow-emerald-500/5'
                    : isCompleted
                    ? 'border-slate-800 bg-slate-900/40 opacity-90'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isLive && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE NOW
                        </span>
                      )}
                      {isCountdown && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock size={11} /> SCHEDULED
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
                          <CheckCircle2 size={11} /> COMPLETED
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {gq.quiz?.difficulty || 'MEDIUM'} · {gq.quiz?.questions?.length || 10} MCQs
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-100">{gq.quiz?.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {gq._count?.participants || gq.participants?.length || 0} participants joined
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {gq.status === 'pending' && (
                      <button
                        onClick={() => startQuizNow(gq.id)}
                        className="text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md"
                      >
                        Start Competition
                      </button>
                    )}

                    {(isLive || isCountdown) && (
                      <>
                        <button
                          onClick={() => joinAndTake(gq.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Play size={13} className="fill-white" /> Take Quiz
                        </button>
                        <button
                          onClick={() => endAndAnnounce(gq.id)}
                          className="text-xs font-medium px-3 py-2 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                          title="Conclude quiz and announce podium results to chat"
                        >
                          End & Announce
                        </button>
                      </>
                    )}

                    <Link
                      to={`/groups/${id}/quizzes/${gq.id}/leaderboard`}
                      className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors"
                    >
                      <Trophy size={13} className="text-amber-400" /> Leaderboard
                    </Link>
                  </div>
                </div>

                {/* Top Winner Card for Completed Quizzes */}
                {isCompleted && topParticipant && (
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Award size={14} /> Winner:
                      </span>
                      <span className="font-semibold text-slate-200">{topParticipant.user?.name}</span>
                      <span className="text-slate-400">
                        ({topParticipant.score}/{gq.quiz?.questions?.length || 10} pts in {topParticipant.timeTakenSecs || 0}s)
                      </span>
                    </div>
                    <Link
                      to={`/groups/${id}/quizzes/${gq.id}/leaderboard`}
                      className="text-blue-400 hover:underline font-medium"
                    >
                      View Podium →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
