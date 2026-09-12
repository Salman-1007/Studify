import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Lock, Globe } from 'lucide-react';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Groups() {
  const [q, setQ] = useState('');
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', q],
    queryFn: () => api.get('/groups', { params: { q } }).then((r) => r.data.data.groups),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Study Groups</h1>
        <Link to="/groups/create" className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Create group
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search public groups"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : groups.length === 0 ? (
        <EmptyState title="No groups found" subtitle="Create the first one for your class or subject." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-600 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{g.name}</p>
                {g.privacy === 'PRIVATE' ? <Lock size={14} className="text-slate-500" /> : <Globe size={14} className="text-slate-500" />}
              </div>
              <p className="text-xs text-slate-500 mt-1">{g.subject || 'General'} · {g._count.members} members</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
