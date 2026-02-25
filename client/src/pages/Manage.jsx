import { useState, useEffect } from 'react';
import { UserPlus, Wifi, WifiOff, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';

const PROVIDERS = ['dexcom', 'nightscout', 'libre'];
const AUTH_MODES = { dexcom: ['publisher', 'follower'], nightscout: ['publisher'], libre: ['publisher'] };

const CABIN_GROUPS = [
  ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 2}B`),   // 2B, 4B … 20B
  ...Array.from({ length: 13 }, (_, i) => `${i * 2 + 1}G`),     // 1G, 3G … 25G
];

const EMPTY_FORM = {
  name: '', cabin_group: '', target_low: 70, target_high: 180, carb_ratio: '',
  delivery_method: 'pump',
  age: '', allergies: '',
  med_breakfast: '', med_lunch: '', med_dinner: '', med_bed: '', med_emergency: '',
  a1c: '', weight: '',
  long_acting_type: '', short_acting_type: '', cgm_pin: '', profile_notes: '',
  home_icr: '', home_isf: '', home_target_bg: 150, activity_level: 'moderate',
  // Pump
  pump_pin: '', closed_loop: false, home_basal_rates: '',
  // Injection
  home_long_acting_am: '', home_long_acting_bed: '',
  // Registration
  reg_recent_illness: '', reg_open_wounds: '', reg_scar_tissue: '', reg_lice: '',
  reg_meds_received: false, reg_cgm_supplies_received: false,
  reg_pump_supplies_received: false, pump_site_count: '', pump_reservoir_count: '',
  reg_sensor_count: '', reg_half_unit_syringes: false,
  // CGM
  cgm_provider: 'dexcom', cgm_auth_mode: 'publisher', cgm_username: '', cgm_password: '', cgm_url: '',
};

function Section({ title, open, onToggle, children }) {
  return (
    <div className="border-t border-slate-100 pt-3 mt-3">
      <button type="button" onClick={onToggle}
        className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && children}
    </div>
  );
}

function Input({ label, hint, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-slate-300" />
      {label}
    </label>
  );
}

function AddCamperForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sections, setSections] = useState({ medical: false, settings: false, registration: false });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggle = (s) => setSections(prev => ({ ...prev, [s]: !prev[s] }));
  const hasCgm = form.cgm_auth_mode === 'follower' || form.cgm_username || form.cgm_password || form.cgm_url;
  const isPump = form.delivery_method === 'pump';

  async function submit(e) {
    e.preventDefault();
    setError(''); setStatus(''); setLoading(true);
    try {
      setStatus('Adding camper...');
      const camper = await api.addCamper(form);
      if (hasCgm) {
        setStatus('Verifying CGM connection...');
        await api.connectCGM(camper.id, {
          cgm_provider: form.cgm_provider, cgm_auth_mode: form.cgm_auth_mode,
          cgm_username: form.cgm_username, cgm_password: form.cgm_password, cgm_url: form.cgm_url,
        });
        const updated = await api.getCampers('all');
        onAdd(updated.find(c => c.id === camper.id) || camper);
      } else {
        onAdd(camper);
      }
      setForm(EMPTY_FORM);
      setStatus('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
      <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <UserPlus size={16} /> Add Camper
      </h2>
      {error && <p className="text-rose-500 text-sm mb-3">{error}</p>}
      {status && <p className="text-blue-500 text-sm mb-3">{status}</p>}

      {/* Basic info — always visible */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <Input label="Full Name *" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Alex Johnson" />
        <div>
          <label className="block text-xs text-slate-500 mb-1">Cabin / Group</label>
          <select value={form.cabin_group} onChange={e => set('cabin_group', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— select cabin —</option>
            {CABIN_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <Input label="Age" type="number" min={1} max={99} value={form.age} onChange={e => set('age', e.target.value)} />
        <div>
          <label className="block text-xs text-slate-500 mb-1">Delivery Method</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => set('delivery_method', 'pump')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${isPump ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
              Pump
            </button>
            <button type="button" onClick={() => set('delivery_method', 'injection')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${!isPump ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
              Injection
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Target Low (mg/dL)" type="number" value={form.target_low} min={50} max={100}
          onChange={e => set('target_low', parseInt(e.target.value))} />
        <Input label="Target High (mg/dL)" type="number" value={form.target_high} min={150} max={300}
          onChange={e => set('target_high', parseInt(e.target.value))} />
        <div className="col-span-2">
          <Input label="Carb Ratio (g per unit)" type="number" value={form.carb_ratio} min={1} max={100} step={1}
            onChange={e => set('carb_ratio', e.target.value)} placeholder="e.g. 15" hint="1u per this many grams" />
        </div>
      </div>

      {/* Medical profile */}
      <Section title="Medical Profile" open={sections.medical} onToggle={() => toggle('medical')}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Allergies" value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="None" />
          <Input label="A1c" type="number" step="0.1" value={form.a1c} onChange={e => set('a1c', e.target.value)} placeholder="e.g. 7.2" />
          <Input label="Weight" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="lbs" />
          <Input label="CGM Pin" value={form.cgm_pin} onChange={e => set('cgm_pin', e.target.value)} />
          <Input label="Long Acting Type" value={form.long_acting_type} onChange={e => set('long_acting_type', e.target.value)} placeholder="e.g. Lantus" />
          <Input label="Short Acting Type" value={form.short_acting_type} onChange={e => set('short_acting_type', e.target.value)} placeholder="e.g. Humalog" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-4 mb-2">Medications</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Breakfast Meds" value={form.med_breakfast} onChange={e => set('med_breakfast', e.target.value)} />
          <Input label="Lunch Meds" value={form.med_lunch} onChange={e => set('med_lunch', e.target.value)} />
          <Input label="Dinner Meds" value={form.med_dinner} onChange={e => set('med_dinner', e.target.value)} />
          <Input label="Bedtime Meds" value={form.med_bed} onChange={e => set('med_bed', e.target.value)} />
          <div className="col-span-2">
            <Input label="Emergency Meds" value={form.med_emergency} onChange={e => set('med_emergency', e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <Input label="Notes" value={form.profile_notes} onChange={e => set('profile_notes', e.target.value)} placeholder="Any additional notes" />
        </div>
      </Section>

      {/* Home settings */}
      <Section title="Home Settings" open={sections.settings} onToggle={() => toggle('settings')}>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Home ICR" type="number" step="0.1" value={form.home_icr} onChange={e => set('home_icr', e.target.value)} />
          <Input label="Home ISF" type="number" step="1" value={form.home_isf} onChange={e => set('home_isf', e.target.value)} />
          <Input label="Home Target BG" type="number" step="5" value={form.home_target_bg} onChange={e => set('home_target_bg', e.target.value)} />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-slate-500 mb-1">Activity Level</label>
          <select value={form.activity_level} onChange={e => set('activity_level', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>
        {isPump ? (
          <div className="mt-3 space-y-3">
            <Input label="Pump Pin" value={form.pump_pin} onChange={e => set('pump_pin', e.target.value)} />
            <Checkbox label="Closed Loop" checked={form.closed_loop} onChange={v => set('closed_loop', v)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input label="Long Acting AM" type="number" step="0.5" value={form.home_long_acting_am} onChange={e => set('home_long_acting_am', e.target.value)} />
            <Input label="Long Acting BED" type="number" step="0.5" value={form.home_long_acting_bed} onChange={e => set('home_long_acting_bed', e.target.value)} />
          </div>
        )}
      </Section>

      {/* Registration checklist */}
      <Section title="Registration Checklist" open={sections.registration} onToggle={() => toggle('registration')}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Recent Illness/Injuries" value={form.reg_recent_illness} onChange={e => set('reg_recent_illness', e.target.value)} />
          <Input label="Open Wounds/Sores" value={form.reg_open_wounds} onChange={e => set('reg_open_wounds', e.target.value)} />
          <Input label="Sites of Scar Tissue" value={form.reg_scar_tissue} onChange={e => set('reg_scar_tissue', e.target.value)} />
          <Input label="Lice/Infestations" value={form.reg_lice} onChange={e => set('reg_lice', e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <Checkbox label="Medications received" checked={form.reg_meds_received} onChange={v => set('reg_meds_received', v)} />
          <Checkbox label="CGM supplies received" checked={form.reg_cgm_supplies_received} onChange={v => set('reg_cgm_supplies_received', v)} />
        </div>
        {isPump ? (
          <div className="mt-3 space-y-3">
            <Checkbox label="Pump supplies received" checked={form.reg_pump_supplies_received} onChange={v => set('reg_pump_supplies_received', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="# of Sites" type="number" value={form.pump_site_count} onChange={e => set('pump_site_count', e.target.value)} />
              <Input label="# of Reservoirs" type="number" value={form.pump_reservoir_count} onChange={e => set('pump_reservoir_count', e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <Input label="# of Sensors" type="number" value={form.reg_sensor_count} onChange={e => set('reg_sensor_count', e.target.value)} />
            <Checkbox label="1/2 unit syringes" checked={form.reg_half_unit_syringes} onChange={v => set('reg_half_unit_syringes', v)} />
          </div>
        )}
      </Section>

      {/* CGM connection */}
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">CGM Connection</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">CGM Device</label>
            <select value={form.cgm_provider} onChange={e => set('cgm_provider', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          {form.cgm_provider === 'dexcom' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Access Mode</label>
              <select value={form.cgm_auth_mode} onChange={e => set('cgm_auth_mode', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="publisher">Direct (camper's account)</option>
                <option value="follower">Follow (camp follows camper)</option>
              </select>
            </div>
          )}
          {form.cgm_provider === 'nightscout' && (
            <div className="col-span-2">
              <Input label="Nightscout URL" value={form.cgm_url} onChange={e => set('cgm_url', e.target.value)} placeholder="https://yourcamper.ns.10be.de" />
            </div>
          )}
          {form.cgm_auth_mode === 'follower' ? (
            <div className="col-span-2">
              <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                Follower mode uses the camp's Dexcom follower account configured in server env vars.
              </p>
            </div>
          ) : (
            <>
              {form.cgm_provider !== 'nightscout' && (
                <Input label="Username / Email" value={form.cgm_username} onChange={e => set('cgm_username', e.target.value)} autoComplete="off" />
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">{form.cgm_provider === 'nightscout' ? 'API Secret' : 'Password'}</label>
                <input type="password" value={form.cgm_password} onChange={e => set('cgm_password', e.target.value)} autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="mt-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
        {loading ? status || 'Saving...' : hasCgm ? 'Add & Connect' : 'Add Camper'}
      </button>
    </form>
  );
}

function ConnectCGMForm({ camper, onConnect, onClose }) {
  const [form, setForm] = useState({
    cgm_provider: 'dexcom', cgm_auth_mode: 'publisher', cgm_username: '', cgm_password: '', cgm_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await api.connectCGM(camper.id, form);
      setSuccess(res.message);
      onConnect();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

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
      {form.cgm_auth_mode !== 'follower' && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {form.cgm_provider !== 'nightscout' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username / Email</label>
              <input value={form.cgm_username} onChange={e => setForm(f => ({ ...f, cgm_username: e.target.value }))} autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">{form.cgm_provider === 'nightscout' ? 'API Secret' : 'Password'}</label>
            <input type="password" value={form.cgm_password} onChange={e => setForm(f => ({ ...f, cgm_password: e.target.value }))} autoComplete="new-password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}
      {form.cgm_auth_mode === 'follower' && (
        <p className="text-xs text-slate-500 mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Follower mode uses the camp's Dexcom follower account (configured in server env vars).
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Verifying...' : 'Verify & Save'}
        </button>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 text-xs px-3 py-2 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function CamperRow({ camper, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    name: camper.name, cabin_group: camper.cabin_group || '',
    target_low: camper.target_low, target_high: camper.target_high,
    carb_ratio: camper.carb_ratio || '', delivery_method: camper.delivery_method || 'pump',
  });

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updateCamper(camper.id, { ...camper, ...form });
      onUpdate(updated);
      setEditing(false);
    } catch (err) { alert(err.message); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.syncCamper(camper.id);
      if (res.error) alert('Sync error: ' + res.error);
      else onUpdate({ ...camper, last_sync_at: new Date().toISOString(), sync_error: null });
    } finally { setSyncing(false); }
  }

  const isPump = (form.delivery_method || camper.delivery_method) === 'pump';

  return (
    <div className="border border-slate-200 rounded-xl bg-white mb-3 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${camper.cgm_connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={saveEdit} className="flex flex-wrap gap-2 items-center">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              <select value={form.cabin_group} onChange={e => setForm(f => ({ ...f, cabin_group: e.target.value }))}
                className="border border-slate-200 rounded px-1 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">—</option>
                {CABIN_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={form.delivery_method} onChange={e => setForm(f => ({ ...f, delivery_method: e.target.value }))}
                className="border border-slate-200 rounded px-1 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="pump">Pump</option>
                <option value="injection">Injection</option>
              </select>
              <input type="number" value={form.target_low} min={50} max={100}
                onChange={e => setForm(f => ({ ...f, target_low: parseInt(e.target.value) }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-xs">-</span>
              <input type="number" value={form.target_high} min={150} max={300}
                onChange={e => setForm(f => ({ ...f, target_high: parseInt(e.target.value) }))}
                className="border border-slate-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded transition-colors hover:bg-blue-500">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 px-2 py-1">Cancel</button>
            </form>
          ) : (
            <div>
              <p className="font-medium text-slate-800 text-sm">
                {camper.name}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${isPump ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isPump ? 'Pump' : 'Injection'}
                </span>
              </p>
              <p className="text-slate-400 text-xs">
                {camper.cabin_group ? `${camper.cabin_group} · ` : ''}
                Range: {camper.target_low}-{camper.target_high}
                {camper.carb_ratio && ` · 1:${camper.carb_ratio}`}
                {camper.cgm_provider && ` · ${camper.cgm_provider}`}
                {camper.sync_error && <span className="text-rose-400 ml-2">! {camper.sync_error}</span>}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { setConnecting(c => !c); setEditing(false); }} title="Connect CGM"
            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded">
            {camper.cgm_connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          </button>
          {camper.cgm_connected && (
            <button onClick={handleSync} disabled={syncing} title="Manual sync"
              className="p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-40 transition-colors rounded">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            </button>
          )}
          <button onClick={() => { setEditing(e => !e); setConnecting(false); }} title="Edit"
            className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded">
            <Pencil size={15} />
          </button>
          <button onClick={() => { if (confirm(`Remove ${camper.name}?`)) onDelete(camper.id); }} title="Remove"
            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {connecting && (
        <div className="px-4 pb-4">
          <ConnectCGMForm camper={camper}
            onConnect={async () => {
              const campers = await api.getCampers('all');
              const updated = campers.find(c => c.id === camper.id);
              if (updated) onUpdate(updated);
              setConnecting(false);
            }}
            onClose={() => setConnecting(false)} />
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
    try { setCampers(await api.getCampers('all')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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

      <AddCamperForm onAdd={c => setCampers(prev => [...prev, c])} />

      <div className="mb-4">
        <input type="search" placeholder="Search campers..." value={search} onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-slate-400 text-sm">No campers yet. Add one above.</p>
      ) : (
        visible.map(c => (
          <CamperRow key={c.id} camper={c}
            onUpdate={u => setCampers(prev => prev.map(x => x.id === u.id ? u : x))}
            onDelete={async id => { await api.deleteCamper(id); setCampers(prev => prev.filter(x => x.id !== id)); }} />
        ))
      )}
    </div>
  );
}
