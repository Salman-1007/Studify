import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus } from 'lucide-react';
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
  const [quizId, setQuizId] = useState('');

  const { data: groupQuizzes, isLoading } = useQuery({
    queryKey: ['group-quizzes', id],
    queryFn: () => api.get(`/groups/${id}/quizzes`).then((r) => r.data.data.groupQuizzes),
  });
  const { data: myQuizzes } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/quizzes').then((r) => r.data.data.quizzes),
  });

  const host = async () => {
    try {
      await api.post(`/groups/${id}/quizzes`, { quizId });
      showToast('Group quiz created', 'success');
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['group-quizzes', id] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Only the owner/moderator can host', 'error');
    }
  };

  const start = async (gqId) => {
    await api.post(`/groups/${id}/quizzes/${gqId}/start`);
    qc.invalidateQueries({ queryKey: ['group-quizzes', id] });
  };

  const joinAndTake = async (gqId) => {
    await api.post(`/groups/${id}/quizzes/${gqId}/join`);
    navigate(`/groups/${id}/quizzes/${gqId}/take`);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link to={`/groups/${id}`} className="text-sm text-slate-400 hover:text-slate-200">← Group</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>Group quiz competitions</h1>
        <button onClick={() => setShowCreate((s) => !s)} className="flex items-center gap-2 text-sm bg-blue-500 hover:bg-blue-600 rounded-lg px-3 py-2">
          <Plus size={14} /> Host a quiz
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <select value={quizId} onChange={(e) => setQuizId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="">Select one of your quizzes…</option>
            {myQuizzes?.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          <button disabled={!quizId} onClick={host} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-medium">
            Create competition
          </button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : groupQuizzes.length === 0 ? (
        <EmptyState title="No group quizzes yet" subtitle="Host one from a quiz you've created to start a competition." />
      ) : (
        <div className="space-y-3">
          {groupQuizzes.map((gq) => (
            <div key={gq.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{gq.quiz.title}</p>
                <p className="text-xs text-slate-500">{gq.status} · {gq._count.participants} joined</p>
              </div>
              {gq.status === 'pending' ? (
                <button onClick={() => start(gq.id)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600">Start</button>
              ) : (
                <button onClick={() => joinAndTake(gq.id)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600">
                  <Play size={13} /> Join
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
