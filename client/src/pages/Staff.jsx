import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound } from 'lucide-react';
import { api } from '../api';

const ROLES = ['nurse', 'counselor', 'admin'];
const CABIN_GROUPS = [
  ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 2}B`),
  ...Array.from({ length: 13 }, (_, i) => `${i * 2 + 1}G`),
];
const ROLE_LABELS = { admin: 'Admin', nurse: 'Med Staff', counselor: 'Counselor' };
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  nurse: 'bg-blue-100 text-blue-700',
  counselor: 'bg-slate-100 text-slate-600',
};

function getUser() {
  try { return JSON.parse(localStorage.getItem('gv_user') || 'null'); } catch { return null; }
}

export default function Staff() {
  const me = getUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [form, setForm] = useState({ username: '', password: '', role: 'nurse', cabin_group: '', medical_access: false });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Password reset
  const [resetId, setResetId] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  async function load() {
    try {
      setUsers(await api.getUsers());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      const user = await api.addUser(form);
      setUsers(prev => [...prev, user]);
      setForm({ username: '', password: '', role: 'nurse', cabin_group: '', medical_access: false });
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id, username) {
    if (!confirm(`Remove ${username}? They will no longer be able to log in.`)) return;
    await api.deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');
    setResetting(true);
    try {
      await api.resetPassword(resetId, resetPw);
      setResetId(null);
      setResetPw('');
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Staff Accounts</h1>
        <p className="text-slate-500 text-sm">{users.length} account{users.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Add staff form */}
      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <UserPlus size={16} /> Add Staff Account
        </h2>
        {addError && <p className="text-rose-500 text-sm mb-3">{addError}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Username *</label>
            <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="off" placeholder="jsmith"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Password *</label>
            <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="new-password" placeholder="Min 6 characters"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Role *</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="nurse">Med Staff — sees all campers</option>
              <option value="counselor">Counselor — sees their cabin</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          {form.role === 'counselor' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cabin / Group</label>
              <select value={form.cabin_group} onChange={e => setForm(f => ({ ...f, cabin_group: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— select cabin —</option>
                {CABIN_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          {form.role === 'counselor' && (
            <div className="col-span-2 flex items-center gap-2 mt-1">
              <input type="checkbox" id="medical_access" checked={form.medical_access}
                onChange={e => setForm(f => ({ ...f, medical_access: e.target.checked }))}
                className="rounded" />
              <label htmlFor="medical_access" className="text-sm text-slate-600">
                Medical access (nurselor) — can view medication notes
              </label>
            </div>
          )}
        </div>
        <button type="submit" disabled={adding}
          className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {adding ? 'Adding…' : 'Add Account'}
        </button>
      </form>

      {/* User list */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
              {resetId === u.id ? (
                <form onSubmit={handleResetPassword} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 mr-1">{u.username}</span>
                  <input type="password" required minLength={6} value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    placeholder="New password"
                    autoFocus
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
                  {resetError && <span className="text-rose-500 text-xs">{resetError}</span>}
                  <button type="submit" disabled={resetting}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {resetting ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setResetId(null); setResetPw(''); setResetError(''); }}
                    className="text-xs text-slate-400 px-2 py-1.5">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {u.username}
                        {u.id === me?.id && <span className="text-slate-400 font-normal"> (you)</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {u.cabin_group ? `${u.cabin_group}` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    {u.role === 'counselor' && u.medical_access ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Nurselor</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setResetId(u.id); setResetPw(''); setResetError(''); }}
                      title="Reset password"
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded">
                      <KeyRound size={15} />
                    </button>
                    {u.id !== me?.id && (
                      <button onClick={() => handleDelete(u.id, u.username)}
                        title="Remove account"
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
