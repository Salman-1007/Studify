import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const initial = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  class: '9',
  board: 'Punjab',
  institution: '',
};

export default function Signup() {
  const { signup, user, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await signup(form);
      showToast('Account created — welcome to Studify!', 'success');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Signup failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-blue-500 mx-auto mb-3 flex items-center justify-center font-bold text-white">S</div>
          <h1 className="text-xl font-semibold text-white" style={{ fontFamily: 'Poppins' }}>Create your account</h1>
          <p className="text-xs text-slate-400 mt-1">Join Studify for Classes 9–12</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Full name</label>
            <input className={inputClass} placeholder="e.g. Salman Adil" value={form.name} onChange={update('name')} required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input type="email" className={inputClass} placeholder="name@example.com" value={form.email} onChange={update('email')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" className={inputClass} placeholder="Min 8 characters" value={form.password} onChange={update('password')} required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Confirm password</label>
              <input type="password" className={inputClass} placeholder="Repeat password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Target Class / Exam Goal</label>
              <select className={inputClass} value={form.class} onChange={update('class')} required>
                <option value="9">Class 9 (Matric 1)</option>
                <option value="10">Class 10 (Matric 2)</option>
                <option value="11">Class 11 (FSc 1)</option>
                <option value="12">Class 12 (FSc 2)</option>
                <option value="MDCAT">MDCAT (Pre-Medical Entry Test)</option>
                <option value="ECAT">ECAT (Engineering Entry Test)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Educational Board</label>
              <select className={inputClass} value={form.board} onChange={update('board')} required>
                <option value="Punjab">Punjab Board</option>
                <option value="Federal/FBISE">Federal (FBISE)</option>
                <option value="Sindh">Sindh Board</option>
                <option value="KPK">KPK Board</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">School / College (optional)</label>
            <input className={inputClass} placeholder="e.g. Punjab Group of Colleges / Army Public School" value={form.institution} onChange={update('institution')} />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{error}</p>}
          <button
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg py-2.5 font-medium text-white transition-colors"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-slate-400 text-center mt-6">
          Already have an account? <Link to="/login" className="text-blue-400 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
