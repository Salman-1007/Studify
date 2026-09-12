import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Skeleton from '../components/Skeleton.jsx';

export default function Admin() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data.data),
  });
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data.data.users),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Admin</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xl font-semibold" style={{ fontFamily: 'Poppins' }}>{value}</p>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{key}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-medium mb-3">Users</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
          {users?.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{u.name} <span className="text-slate-500">@{u.username}</span></span>
              <span className={`text-xs ${u.isActive ? 'text-emerald-400' : 'text-red-400'}`}>{u.isActive ? 'Active' : 'Deactivated'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
