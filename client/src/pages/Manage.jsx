import { useState, useEffect } from 'react';
import { UserPlus, Wifi, WifiOff, Pencil, Trash2, Link2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';

const PROVIDERS = ['dexcom', 'nightscout', 'libre'];
const AUTH_MODES = { dexcom: ['publisher', 'follower'], nightscout: ['publisher'], libre: ['publisher'] };

function AddCamperForm({ onAdd }) {
  const [form, setForm] = useState({ name: '', cabin_group: '', target_low: 70, target_high: 180, carb_ratio: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const camper = await api.addCamper(form);
      onAdd(camper);
      setForm({ name: '', cabin_group: '', target_low: 70, target_high: 180, carb_ratio: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
      <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <UserPlus size={16} /> Add Camper
      </h2>
      {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Full Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Alex Johnson" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Cabin / Group</label>
          <input value={form.cabin_group} onChange={e => setForm(f => ({ ...f, cabin_group: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cabin 4" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Target Low (mg/dL)</label>
          <input type="number" value={form.target_low} min={50} max={100}
            onChange={e => setForm(f => ({ ...f, target_low: parseInt(e.target.value) }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Target High (mg/dL)</label>
          <input type="number" value={form.target_high} min={150} max={300}
            onChange={e => setForm(f => ({ ...f, target_high: parseInt(e.target.value) }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Carb Ratio (g per unit) <span className="text-slate-400">— e.g. 15 means 1u per 15g carbs</span></label>
          <input type="number" value={form.carb_ratio} min={1} max={100} step={1}
            onChange={e => setForm(f => ({ ...f, carb_ratio: e.target.value }))}
            placeholder="e.g. 15"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        {loading ? 'Adding…' : 'Add Camper'}
      </button>
    </form>
  );
}

function ConnectCGMForm({ camper, onConnect, onClose }) {
  const [form, setForm] = useState({
    cgm_provider: 'dexcom',
    cgm_auth_mode: 'publisher',
    cgm_username: '',
    cgm_password: '',
    cgm_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const res = await api.connectCGM(camper.id, form);
      setSuccess(res.message);
      onConnect();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const modes = AUTH_MODES[form.cgm_provider] || ['publisher'];

  return (
    <form onSubmit={submit} className="mt-3 bg-slate-50 rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Connect CGM for {camper.name}</h3>
      {error && <p className="text-rose-500 text-xs mb-2">{error}</p>}
      {success && <p className="text-emerald-600 text-xs mb-2">{success}</p>}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">CGM Device</label>
          <select value={form.cgm_provider}
            onChange={e => setForm(f => ({ ...f, cgm_provider: e.target.value, cgm_auth_mode: 'publisher' }))}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        {form.cgm_provider === 'dexcom' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Access Mode</label>
            <select value={form.cgm_auth_mode}
              onChange={e => setForm(f => ({ ...f, cgm_auth_mode: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="publisher">Direct (camper's account)</option>
              <option value="follower">Follow (camp follows camper)</option>
            </select>
          </div>
        )}
      </div>

      {form.cgm_provider === 'nightscout' && (
        <div className="mb-3">
          <label className="block text-xs text-slate-500 mb-1">Nightscout URL</label>
          <input value={form.cgm_url} onChange={e => setForm(f => ({ ...f, cgm_url: e.target.value }))}
            placeholder="https://yourcamper.ns.10be.de"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      {form.cgm_auth_mode !== 'follower' && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {form.cgm_provider !== 'nightscout' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username / Email</label>
              <input value={form.cgm_username} onChange={e => setForm(f => ({ ...f, cgm_username: e.target.value }))}
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {form.cgm_provider === 'nightscout' ? 'API Secret' : 'Password'}
            </label>
            <input type="password" value={form.cgm_password}
              onChange={e => setForm(f => ({ ...f, cgm_password: e.target.value }))}
              autoComplete="new-password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}

      {form.cgm_auth_mode === 'follower' && (
        <p className="text-xs text-slate-500 mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Follower mode uses the camp's Dexcom follower account (configured in server env vars).
          The camper's family must add the camp account as a follower in the Dexcom app.
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Verifying…' : 'Verify & Save'}
        </button>
        <button type="button" onClick={onClose}
          className="text-slate-500 hover:text-slate-700 text-xs px-3 py-2 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CamperRow({ camper, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ name: camper.name, cabin_group: camper.cabin_group || '', target_low: camper.target_low, target_high: camper.target_high, carb_ratio: camper.carb_ratio || '' });

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updateCamper(camper.id, form);
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.syncCamper(camper.id);
      if (res.error) alert('Sync error: ' + res.error);
      else onUpdate({ ...camper, last_sync_at: new Date().toISOString(), sync_error: null });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white mb-3 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${camper.cgm_connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={saveEdit} className="flex flex-wrap gap-2 items-center">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              <input value={form.cabin_group} onChange={e => setForm(f => ({ ...f, cabin_group: e.target.value }))}
                placeholder="Cabin" className="border border-slate-200 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" value={form.target_low} min={50} max={100}
                onChange={e => setForm(f => ({ ...f, target_low: parseInt(e.target.value) }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-xs">–</span>
              <input type="number" value={form.target_high} min={150} max={300}
                onChange={e => setForm(f => ({ ...f, target_high: parseInt(e.target.value) }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" value={form.carb_ratio} min={1} max={100} step={1}
                onChange={e => setForm(f => ({ ...f, carb_ratio: e.target.value }))}
                placeholder="1:? ratio"
                title="Carb ratio (g per unit)"
                className="border border-slate-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded transition-colors hover:bg-blue-500">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 px-2 py-1">Cancel</button>
            </form>
          ) : (
            <div>
              <p className="font-medium text-slate-800 text-sm">{camper.name}</p>
              <p className="text-slate-400 text-xs">
                {camper.cabin_group ? `${camper.cabin_group} · ` : ''}
                Range: {camper.target_low}–{camper.target_high} mg/dL
                {camper.carb_ratio && ` · 1:${camper.carb_ratio} ratio`}
                {camper.cgm_provider && ` · ${camper.cgm_provider}`}
                {camper.sync_error && <span className="text-rose-400 ml-2">⚠ {camper.sync_error}</span>}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { setConnecting(c => !c); setEditing(false); }}
            title="Connect CGM" className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded">
            {camper.cgm_connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          </button>
          {camper.cgm_connected && (
            <button onClick={handleSync} disabled={syncing} title="Manual sync"
              className="p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-40 transition-colors rounded">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            </button>
          )}
          <button onClick={() => { setEditing(e => !e); setConnecting(false); }}
            title="Edit" className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded">
            <Pencil size={15} />
          </button>
          <button onClick={() => { if (confirm(`Remove ${camper.name}?`)) onDelete(camper.id); }}
            title="Remove" className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {connecting && (
        <div className="px-4 pb-4">
          <ConnectCGMForm
            camper={camper}
            onConnect={async () => {
              const campers = await api.getCampers('all');
              const updated = campers.find(c => c.id === camper.id);
              if (updated) onUpdate(updated);
              setConnecting(false);
            }}
            onClose={() => setConnecting(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function Manage() {
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const data = await api.getCampers('all');
      setCampers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleAdd(camper) {
    setCampers(prev => [...prev, camper]);
  }

  function handleUpdate(updated) {
    setCampers(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  async function handleDelete(id) {
    await api.deleteCamper(id);
    setCampers(prev => prev.filter(c => c.id !== id));
  }

  const visible = campers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cabin_group || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Campers</h1>
          <p className="text-slate-500 text-sm">{campers.length} total · {campers.filter(c => c.cgm_connected).length} connected</p>
        </div>
      </div>

      <AddCamperForm onAdd={handleAdd} />

      <div className="mb-4">
        <input
          type="search" placeholder="Search campers…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-slate-400 text-sm">No campers yet. Add one above.</p>
      ) : (
        visible.map(c => (
          <CamperRow key={c.id} camper={c} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))
      )}
    </div>
  );
}
