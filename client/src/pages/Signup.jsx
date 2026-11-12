import { useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { isApprovedTeacherUser } from '../components/ProtectedRoute.jsx';

export default function Signup() {
  const { signup, user, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'teacher' ? 'TEACHER' : 'STUDENT';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: initialRole,
    teacherInviteCode: '',
    class: '9',
    board: 'Punjab',
    institution: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to={isApprovedTeacherUser(user) ? '/teacher/dashboard' : '/dashboard'} replace />;
  }

  const update = (key) => (e) => {
    const val = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === 'class') {
        if (val === 'MDCAT') next.board = 'PMDC';
        else if (val === 'ECAT') next.board = 'UET';
        else if (['PMDC', 'UET'].includes(next.board)) next.board = 'Punjab';
      }
      return next;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        teacherInviteCode: form.accountType === 'TEACHER' && form.teacherInviteCode.trim()
          ? form.teacherInviteCode.trim()
          : undefined,
      };
      const data = await signup(payload);
      if (data.pendingTeacherApproval) {
        showToast('Account created! Educator access is pending administrator approval.', 'info');
        navigate('/dashboard');
      } else if (isApprovedTeacherUser(data.user)) {
        showToast('Educator account verified — welcome to Studify!', 'success');
        navigate('/teacher/dashboard');
      } else {
        showToast('Account created — welcome to Studify!', 'success');
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Signup failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] mx-auto mb-3 flex items-center justify-center font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Poppins' }}>
            Create your account
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Join Studify as a student or verified educator
          </p>
        </div>

        {/* Account Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] mb-5">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, accountType: 'STUDENT' }))}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              form.accountType === 'STUDENT'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen size={14} /> Student
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, accountType: 'TEACHER' }))}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              form.accountType === 'TEACHER'
                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <GraduationCap size={14} /> Educator
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Full name</label>
            <input className={inputClass} placeholder="e.g. Salman Adil" value={form.name} onChange={update('name')} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
            <input type="email" className={inputClass} placeholder="name@example.com" value={form.email} onChange={update('email')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
              <input type="password" className={inputClass} placeholder="Min 8 characters" value={form.password} onChange={update('password')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Confirm password</label>
              <input type="password" className={inputClass} placeholder="Repeat password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
            </div>
          </div>

          {form.accountType === 'STUDENT' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Target Class / Exam</label>
                <select className={inputClass} value={form.class} onChange={update('class')} required>
                  <option value="9">Class 9 (Matric 1)</option>
                  <option value="10">Class 10 (Matric 2)</option>
                  <option value="11">Class 11 (FSc 1)</option>
                  <option value="12">Class 12 (FSc 2)</option>
                  <option value="MDCAT">MDCAT (Pre-Medical)</option>
                  <option value="ECAT">ECAT (Engineering)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Educational Board</label>
                <select className={inputClass} value={form.board} onChange={update('board')} required>
                  <option value="Punjab">Punjab Board</option>
                  <option value="Federal/FBISE">Federal (FBISE)</option>
                  <option value="Sindh">Sindh Board</option>
                  <option value="KPK">KPK Board</option>
                  <option value="PMDC">PMDC (MDCAT)</option>
                  <option value="UET">UET (ECAT)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3.5 space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Educator Invite Code <span className="text-[var(--text-muted)]">(Optional)</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="e.g. EDU-XXXXXXXX"
                  value={form.teacherInviteCode}
                  onChange={update('teacherInviteCode')}
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                With a valid educator invite code, your teacher workspace activates immediately. Otherwise, your educator request is queued for administrator approval.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">School / College / University (optional)</label>
            <input className={inputClass} placeholder="e.g. Punjab Group of Colleges" value={form.institution} onChange={update('institution')} />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{error}</p>}

          <button
            disabled={submitting}
            className="w-full bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-60 rounded-xl py-2.5 font-semibold text-sm text-white transition-all cursor-pointer"
          >
            {submitting ? 'Creating account…' : form.accountType === 'TEACHER' ? 'Create Educator Account' : 'Create Student Account'}
          </button>
        </form>

        <p className="text-sm text-[var(--text-muted)] text-center mt-6">
          Already have an account? <Link to="/login" className="text-[var(--accent-primary)] hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
