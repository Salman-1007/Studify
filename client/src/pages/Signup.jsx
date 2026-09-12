import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const initial = {
  name: '', username: '', email: '', password: '', confirmPassword: '',
  educationLevel: 'UNIVERSITY', grade: '', institution: '',
};

export default function Signup() {
  const { register, user, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(form);
      showToast('Account created — welcome to Studify!', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
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
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full name</label>
              <input className={inputClass} value={form.name} onChange={update('name')} required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Username</label>
              <input className={inputClass} value={form.username} onChange={update('username')} required />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input type="email" className={inputClass} value={form.email} onChange={update('email')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" className={inputClass} value={form.password} onChange={update('password')} required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Confirm password</label>
              <input type="password" className={inputClass} value={form.confirmPassword} onChange={update('confirmPassword')} required />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Education level</label>
            <select className={inputClass} value={form.educationLevel} onChange={update('educationLevel')}>
              <option value="SCHOOL">School</option>
              <option value="COLLEGE">College</option>
              <option value="UNIVERSITY">University</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Class / grade (optional)</label>
              <input className={inputClass} value={form.grade} onChange={update('grade')} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Institution (optional)</label>
              <input className={inputClass} value={form.institution} onChange={update('institution')} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg py-2.5 font-medium text-white"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-slate-400 text-center mt-6">
          Already have an account? <Link to="/login" className="text-blue-400">Log in</Link>
        </p>
      </div>
    </div>
  );
}
