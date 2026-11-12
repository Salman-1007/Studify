import { useState } from 'react';
import { Sun, Moon, Monitor, Shield, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const showOnlineStatus = user?.showOnlineStatus !== false;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put('/users/profile/password', form);
      showToast('Password changed', 'success');
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not change password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOnlinePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      const next = !showOnlineStatus;
      const res = await api.put('/users/profile', { showOnlineStatus: next });
      if (res.data?.data?.user) setUser((prev) => ({ ...(prev || {}), ...res.data.data.user }));
      showToast(`Online status ${next ? 'visible' : 'hidden'}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update privacy setting', 'error');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const themeOptions = [
    { id: 'dark', label: 'Dark', desc: 'Midnight slate interface', icon: Moon },
    { id: 'light', label: 'Light', desc: 'Clean daytime workspace', icon: Sun },
    { id: 'system', label: 'System', desc: 'Follow OS preference', icon: Monitor },
  ];

  return (
    <div className="max-w-2xl space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Poppins' }}>
          Settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage your appearance, messaging privacy, and account security.
        </p>
      </div>

      {/* Appearance Section */}
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-base text-[var(--text-primary)]">Appearance</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Choose how Studify looks across all devices. Saved to your account automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map(({ id, label, desc, icon: Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTheme(id);
                  showToast(`${label} theme applied`, 'success');
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'border-[var(--accent-primary)] bg-indigo-500/10 ring-1 ring-indigo-500/30'
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} className={active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'} />
                  {active && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--accent-primary)] text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Privacy Section */}
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-5 sm:p-6 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-[var(--text-primary)]">Show Online & Last-Seen Status</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Allow classmates and educators in your chats to see when you are active.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showOnlineStatus}
          disabled={savingPrivacy}
          onClick={toggleOnlinePrivacy}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            showOnlineStatus ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </section>

      {/* Account Security */}
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-[var(--accent-primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">Change Password</h2>
        </div>
        <form onSubmit={submit} className="space-y-3 max-w-md">
          <input
            type="password"
            required
            placeholder="Current password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
          />
          <input
            type="password"
            required
            placeholder="New password (min. 8 characters)"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
          />
          <button
            disabled={submitting}
            className="bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-60 rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer"
          >
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
