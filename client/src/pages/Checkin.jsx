import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const CABIN_GROUPS = [
  ...Array.from({ length: 10 }, (_, i) => `${(i + 1) * 2}B`),   // 2B, 4B … 20B
  ...Array.from({ length: 13 }, (_, i) => `${i * 2 + 1}G`),     // 1G, 3G … 25G
];

function StepBar({ step, total }) {
  return (
    <div className="flex gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
      ))}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'text-xs text-slate-500 mb-1 block';

export default function Checkin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [camperId, setCamperId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [doneName, setDoneName] = useState('');
  const [doneCabin, setDoneCabin] = useState('');

  // Step 1: Basic Info
  const [s1, setS1] = useState({
    name: '', cabin_group: '', age: '', delivery_method: 'pump',
    target_low: 70, target_high: 180, carb_ratio: '',
  });

  // Step 2: Medical Profile
  const [s2, setS2] = useState({
    allergies: '', a1c: '', weight: '', long_acting_type: '', short_acting_type: '',
    cgm_pin: '', med_breakfast: '', med_lunch: '', med_dinner: '',
    med_bed: '', med_emergency: '', profile_notes: '',
  });

  // Step 3: Registration Checklist
  const [s3, setS3] = useState({
    reg_recent_illness: '', reg_open_wounds: '', reg_scar_tissue: '', reg_lice: '',
    reg_meds_received: false, reg_cgm_supplies_received: false,
    pump_pin: '', closed_loop: false, reg_pump_supplies_received: false,
    pump_site_count: '', pump_reservoir_count: '',
    home_long_acting_am: '', home_long_acting_bed: '',
    reg_sensor_count: '', reg_half_unit_syringes: false,
  });

  // Step 4: CGM Connection
  const [cgmProvider, setCgmProvider] = useState('dexcom');
  const [cgmAuthMode, setCgmAuthMode] = useState('publisher');
  const [cgmUsername, setCgmUsername] = useState('');
  const [cgmPassword, setCgmPassword] = useState('');
  const [cgmUrl, setCgmUrl] = useState('');

  const isPump = s1.delivery_method === 'pump';

  function f1(field) {
    return e => setS1(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }
  function f2(field) {
    return e => setS2(prev => ({ ...prev, [field]: e.target.value }));
  }
  function f3(field) {
    return e => setS3(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  async function handleStep1() {
    if (!s1.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const data = await api.addCamper(s1);
      setCamperId(data.id);
      setDoneName(data.name);
      setDoneCabin(data.cabin_group || '');
      setStep(2);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleStep2() {
    setSaving(true); setError('');
    try {
      await api.updateCamper(camperId, s2);
      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleStep3() {
    setSaving(true); setError('');
    try {
      await api.updateCamper(camperId, s3);
      setStep(4);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleStep4() {
    setSaving(true); setError('');
    try {
      await api.connectCGM(camperId, {
        cgm_provider: cgmProvider,
        cgm_auth_mode: cgmAuthMode,
        cgm_username: cgmUsername || null,
        cgm_password: cgmPassword || null,
        cgm_url: cgmUrl || null,
      });
      setDone(true);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function handleSkipCGM() {
    setDone(true);
  }

  function resetAll() {
    setStep(1); setCamperId(null); setDone(false); setError('');
    setDoneName(''); setDoneCabin('');
    setS1({ name: '', cabin_group: '', age: '', delivery_method: 'pump', target_low: 70, target_high: 180, carb_ratio: '' });
    setS2({ allergies: '', a1c: '', weight: '', long_acting_type: '', short_acting_type: '', cgm_pin: '', med_breakfast: '', med_lunch: '', med_dinner: '', med_bed: '', med_emergency: '', profile_notes: '' });
    setS3({ reg_recent_illness: '', reg_open_wounds: '', reg_scar_tissue: '', reg_lice: '', reg_meds_received: false, reg_cgm_supplies_received: false, pump_pin: '', closed_loop: false, reg_pump_supplies_received: false, pump_site_count: '', pump_reservoir_count: '', home_long_acting_am: '', home_long_acting_bed: '', reg_sensor_count: '', reg_half_unit_syringes: false });
    setCgmProvider('dexcom'); setCgmAuthMode('publisher'); setCgmUsername(''); setCgmPassword(''); setCgmUrl('');
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-200 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-emerald-600 text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Check-In Complete</h2>
          <p className="text-slate-700 font-medium">{doneName}</p>
          {doneCabin && <p className="text-slate-500 text-sm mb-6">{doneCabin}</p>}
          {!doneCabin && <div className="mb-6" />}
          <div className="flex flex-col gap-2">
            <button onClick={resetAll}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
              Check In Another
            </button>
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const STEP_LABELS = ['Basic Info', 'Medical', 'Registration', 'CGM'];

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800 mb-0.5">Camper Check-In</h1>
      <p className="text-slate-500 text-sm mb-4">Step {step} of 4 — {STEP_LABELS[step - 1]}</p>
      <StepBar step={step} total={4} />

      {error && <p className="text-rose-600 text-sm mb-4 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Name <span className="text-rose-500">*</span></label>
            <input type="text" value={s1.name} onChange={f1('name')} placeholder="Camper name" className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cabin / Group</label>
              <select value={s1.cabin_group} onChange={f1('cabin_group')} className={inputCls}>
                <option value="">— select cabin —</option>
                {CABIN_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Age</label>
              <input type="number" min="1" max="25" value={s1.age} onChange={f1('age')} placeholder="Years" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Delivery Method</label>
            <div className="flex gap-2">
              {['pump', 'injection'].map(m => (
                <button key={m} type="button" onClick={() => setS1(p => ({ ...p, delivery_method: m }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${s1.delivery_method === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Target Low</label>
              <input type="number" value={s1.target_low} onChange={f1('target_low')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Target High</label>
              <input type="number" value={s1.target_high} onChange={f1('target_high')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Carb Ratio</label>
              <input type="number" step="0.5" value={s1.carb_ratio} onChange={f1('carb_ratio')} placeholder="1:?" className={inputCls} />
            </div>
          </div>
          {!s1.name.trim() && (
            <p className="text-xs text-slate-400 text-center -mb-1">Enter a name above to continue</p>
          )}
          <button onClick={handleStep1} disabled={saving || !s1.name.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors mt-2">
            {saving ? 'Saving...' : 'Next: Medical Profile'}
          </button>
        </div>
      )}

      {/* Step 2: Medical Profile */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Allergies</label>
            <input type="text" value={s2.allergies} onChange={f2('allergies')} placeholder="e.g. Peanuts, latex" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>A1c (%)</label>
              <input type="number" step="0.1" value={s2.a1c} onChange={f2('a1c')} placeholder="7.2" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Weight (lbs)</label>
              <input type="number" value={s2.weight} onChange={f2('weight')} placeholder="100" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Short Acting Insulin</label>
              <input type="text" value={s2.short_acting_type} onChange={f2('short_acting_type')} placeholder="e.g. Humalog" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Long Acting Insulin</label>
              <input type="text" value={s2.long_acting_type} onChange={f2('long_acting_type')} placeholder="e.g. Lantus" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>CGM Pin (4-digit)</label>
            <input type="text" maxLength={4} value={s2.cgm_pin} onChange={f2('cgm_pin')} placeholder="1234" className={inputCls} />
          </div>
          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Medications</p>
            <div className="grid grid-cols-2 gap-2">
              {[['med_breakfast','Breakfast'], ['med_lunch','Lunch'], ['med_dinner','Dinner'], ['med_bed','Bedtime'], ['med_emergency','Emergency']].map(([field, label]) => (
                <div key={field}>
                  <label className={labelCls}>{label}</label>
                  <input type="text" value={s2[field]} onChange={f2(field)} placeholder="Medication name" className={inputCls} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Profile Notes</label>
            <textarea value={s2.profile_notes} onChange={f2('profile_notes')} rows={2} placeholder="Any additional medical notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={handleStep2} disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving...' : 'Next: Registration'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Registration Checklist */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Physical Check</p>
          <div className="grid grid-cols-2 gap-2">
            {[['reg_recent_illness','Recent Illness'], ['reg_open_wounds','Open Wounds'], ['reg_scar_tissue','Scar Tissue'], ['reg_lice','Lice']].map(([field, label]) => (
              <div key={field}>
                <label className={labelCls}>{label}</label>
                <input type="text" value={s3[field]} onChange={f3(field)} placeholder="Notes or none" className={inputCls} />
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Supplies Received</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={s3.reg_meds_received} onChange={f3('reg_meds_received')} className="rounded border-slate-300" />
                Medications received
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={s3.reg_cgm_supplies_received} onChange={f3('reg_cgm_supplies_received')} className="rounded border-slate-300" />
                CGM supplies received
              </label>
              {isPump ? (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={s3.reg_pump_supplies_received} onChange={f3('reg_pump_supplies_received')} className="rounded border-slate-300" />
                    Pump supplies received
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={s3.closed_loop} onChange={f3('closed_loop')} className="rounded border-slate-300" />
                    Closed loop system
                  </label>
                </>
              ) : (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={s3.reg_half_unit_syringes} onChange={f3('reg_half_unit_syringes')} className="rounded border-slate-300" />
                  Half-unit syringes
                </label>
              )}
            </div>
          </div>

          {isPump ? (
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pump Details</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Pump Pin</label>
                  <input type="text" maxLength={6} value={s3.pump_pin} onChange={f3('pump_pin')} placeholder="PIN" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Site Count</label>
                  <input type="number" value={s3.pump_site_count} onChange={f3('pump_site_count')} placeholder="#" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Reservoir Count</label>
                  <input type="number" value={s3.pump_reservoir_count} onChange={f3('pump_reservoir_count')} placeholder="#" className={inputCls} />
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Injection Details</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Long Acting AM (u)</label>
                  <input type="number" step="0.5" value={s3.home_long_acting_am} onChange={f3('home_long_acting_am')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Long Acting BED (u)</label>
                  <input type="number" step="0.5" value={s3.home_long_acting_bed} onChange={f3('home_long_acting_bed')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sensor Count</label>
                  <input type="number" value={s3.reg_sensor_count} onChange={f3('reg_sensor_count')} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep(2)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={handleStep3} disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving...' : 'Next: CGM Setup'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: CGM Connection */}
      {step === 4 && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>CGM Provider</label>
            <div className="flex gap-2">
              {['dexcom', 'nightscout', 'libre'].map(p => (
                <button key={p} type="button" onClick={() => setCgmProvider(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${cgmProvider === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {p === 'nightscout' ? 'Nightscout' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {cgmProvider === 'dexcom' && (
            <div>
              <label className={labelCls}>Auth Mode</label>
              <div className="flex gap-2">
                {['publisher', 'follower'].map(m => (
                  <button key={m} type="button" onClick={() => setCgmAuthMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${cgmAuthMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cgmProvider !== 'nightscout' && cgmAuthMode !== 'follower' && (
            <div>
              <label className={labelCls}>Username / Email</label>
              <input type="text" value={cgmUsername} onChange={e => setCgmUsername(e.target.value)}
                placeholder={cgmProvider === 'dexcom' ? 'Dexcom username' : 'LibreLinkUp email'} className={inputCls}
                autoComplete="off" />
            </div>
          )}

          {cgmProvider === 'nightscout' ? (
            <>
              <div>
                <label className={labelCls}>Nightscout URL</label>
                <input type="url" value={cgmUrl} onChange={e => setCgmUrl(e.target.value)}
                  placeholder="https://site.herokuapp.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>API Secret</label>
                <input type="password" value={cgmPassword} onChange={e => setCgmPassword(e.target.value)}
                  placeholder="API secret" className={inputCls} autoComplete="new-password" />
              </div>
            </>
          ) : cgmAuthMode !== 'follower' ? (
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" value={cgmPassword} onChange={e => setCgmPassword(e.target.value)}
                placeholder="Password" className={inputCls} autoComplete="new-password" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              Follower mode uses camp credentials configured on the server.
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep(3)} className="py-3 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={handleStep4} disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? 'Connecting...' : 'Connect & Finish'}
            </button>
          </div>
          <button onClick={handleSkipCGM}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Skip CGM setup for now
          </button>
        </div>
      )}
    </div>
  );
}
