import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const isApprovedTeacherUser = (user) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.role === 'TEACHER' && user.teacherStatus !== 'PENDING' && user.teacherStatus !== 'REJECTED';
};

export default function ProtectedRoute({ adminOnly = false, teacherOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (teacherOnly && !isApprovedTeacherUser(user)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
