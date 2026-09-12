import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trophy, ListChecks, Copy, LogOut } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.get(`/groups/${id}`).then((r) => r.data.data.group),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  const membership = group.members.find((m) => m.user.id === user.id);
  const isMember = Boolean(membership);
  const isOwner = membership?.role === 'OWNER';

  const join = async () => {
    try {
      let joinCode;
      if (group.privacy === 'PRIVATE') {
        joinCode = window.prompt('Enter the group join code');
        if (!joinCode) return;
      }
      await api.post(`/groups/${id}/join`, { joinCode });
      qc.invalidateQueries({ queryKey: ['group', id] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not join', 'error');
    }
  };

  const leave = async () => {
    await api.post(`/groups/${id}/leave`);
    navigate('/groups');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(group.joinCode);
    showToast('Join code copied', 'success');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/groups" className="text-sm text-slate-400 hover:text-slate-200">← Study Groups</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>{group.name}</h1>
          {isMember ? (
            !isOwner && <button onClick={leave} className="flex items-center gap-1 text-sm text-red-400"><LogOut size={14} /> Leave</button>
          ) : (
            <button onClick={join} className="bg-blue-500 hover:bg-blue-600 text-sm px-4 py-2 rounded-lg font-medium">Join group</button>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-1">{group.description || 'No description yet.'}</p>
        {isOwner && (
          <button onClick={copyCode} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-2">
            <Copy size={12} /> Join code: {group.joinCode}
          </button>
        )}
      </div>

      {isMember && (
        <div className="grid grid-cols-3 gap-3">
          <Link to={`/groups/${id}/chat`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4 text-center">
            <MessageSquare className="mx-auto text-blue-400 mb-1" size={18} />
            <p className="text-sm">Chat</p>
          </Link>
          <Link to={`/groups/${id}/quizzes`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4 text-center">
            <ListChecks className="mx-auto text-emerald-400 mb-1" size={18} />
            <p className="text-sm">Quizzes</p>
          </Link>
          <Link to={`/groups/${id}/leaderboard`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4 text-center">
            <Trophy className="mx-auto text-amber-400 mb-1" size={18} />
            <p className="text-sm">Leaderboard</p>
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-medium mb-3">Members ({group.members.length})</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.user.name}</span>
              <span className="text-xs text-slate-500">{m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
