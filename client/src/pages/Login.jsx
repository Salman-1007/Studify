import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { isApprovedTeacherUser } from '../components/ProtectedRoute.jsx';

export default function Login() {
  const { login, user, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to={isApprovedTeacherUser(user) ? '/teacher/dashboard' : '/dashboard'} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await login(identifier, password);
      showToast('Welcome back!', 'success');
      navigate(isApprovedTeacherUser(data?.user) ? '/teacher/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xl">
        <div className="text-center mb-7">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] mx-auto mb-3 flex items-center justify-center font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Poppins' }}>
            Log in to Studify
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Access your student or educator workspace
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email or username</label>
            <input
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{error}</p>}
          <button
            disabled={submitting}
            className="w-full bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-60 rounded-xl py-2.5 font-semibold text-sm text-white cursor-pointer"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="text-sm text-[var(--text-muted)] text-center mt-6">
          New to Studify? <Link to="/signup" className="text-[var(--accent-primary)] hover:underline font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
