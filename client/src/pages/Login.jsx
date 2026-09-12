import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { login, user, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(identifier, password);
      showToast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-500 mx-auto mb-3 flex items-center justify-center font-bold text-white">S</div>
          <h1 className="text-xl font-semibold text-white" style={{ fontFamily: 'Poppins' }}>Log in to Studify</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email or username</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg py-2.5 font-medium text-white"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="text-sm text-slate-400 text-center mt-6">
          New to Studify? <Link to="/signup" className="text-blue-400">Create an account</Link>
        </p>
        <p className="text-xs text-slate-500 text-center mt-3">
          Demo login: demo@studify.app / Demo1234
        </p>
      </div>
    </div>
  );
}
