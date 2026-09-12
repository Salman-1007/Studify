import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const { showToast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Poppins' }}>Settings</h1>
      <div>
        <h2 className="font-medium mb-3">Change password</h2>
        <form onSubmit={submit} className="space-y-3">
          <input type="password" required placeholder="Current password" value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input type="password" required placeholder="New password (min. 8 characters)" value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <button disabled={submitting} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg px-4 py-2 text-sm font-medium">
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
