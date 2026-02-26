import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Trash2, Pill, Check, ChevronLeft, ChevronRight, Printer, Download, Activity, Droplets, TrendingUp, BarChart2 } from 'lucide-react';
import { api } from '../api';
import GlucoseIndicator, { getGlucoseStatus, STATUS_STYLES } from '../components/GlucoseIndicator';
import GlucoseChart from '../components/GlucoseChart';

const HOUR_TABS = [1, 3, 6, 12, 24];
const QUICK_CARBS = [
  { label: 'NABS', g: 15 },
  { label: 'Tabs', g: 15 },
];

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', start: 7, end: 9.5 },
  { key: 'snack_am', label: 'AM Snack', start: 9.5, end: 11.5 },
  { key: 'lunch', label: 'Lunch', start: 11.5, end: 13.5 },
  { key: 'snack_pm', label: 'PM Snack', start: 13.5, end: 16.5 },
  { key: 'dinner', label: 'Dinner', start: 16.5, end: 19.5 },
];

const MED_WINDOWS = [
  { slot: 'morning', label: 'Morning', start: 6, end: 10, fields: ['med_breakfast'] },
  { slot: 'afternoon', label: 'Afternoon', start: 11, end: 14, fields: ['med_lunch'] },
  { slot: 'evening', label: 'Evening', start: 17, end: 24, fields: ['med_dinner', 'med_bed'] },
];

function timeAgo(iso) {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toLocalDate(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayButton(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function currentHourDecimal() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('gv_user')); } catch { return null; }
}

// Meal badge colors
const MEAL_COLORS = {
  breakfast: 'bg-violet-100 text-violet-700',
  snack_am: 'bg-pink-100 text-pink-700',
  lunch: 'bg-violet-100 text-violet-700',
  snack_pm: 'bg-pink-100 text-pink-700',
  dinner: 'bg-violet-100 text-violet-700',
};

function EventRow({ event, onDelete, showDate }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 mb-0.5">
          {event.meal_type && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${MEAL_COLORS[event.meal_type] || 'bg-violet-100 text-violet-700'}`}>
              {MEALS.find(m => m.key === event.meal_type)?.label || event.meal_type}
            </span>
          )}
          {event.med_slot && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
              <Pill size={10} className="mr-1" /> {event.med_slot} meds
            </span>
          )}
          {event.bg_manual > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              BG {event.bg_manual}
            </span>
          )}
          {event.ketones > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Ketones {event.ketones}
            </span>
          )}
          {event.carbs_g != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              {event.carbs_g}g carbs
            </span>
          )}
          {(event.dose_given > 0 || event.insulin_units > 0) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {event.dose_given || event.insulin_units}u given
            </span>
          )}
          {event.calc_dose > 0 && event.calc_dose !== event.dose_given && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-500">
              calc {event.calc_dose}u
            </span>
          )}
          {event.basal_rate > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {event.basal_rate}u/hr basal
            </span>
          )}
          {!!event.site_change && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              Site change
            </span>
          )}
          {!!event.prebolus && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
              Prebolus
            </span>
          )}
          {!!event.long_acting_given && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
              Long acting
            </span>
          )}
        </div>
        {event.note && <p className="text-sm text-slate-600 mt-0.5">{event.note}</p>}
        <p className="text-xs text-slate-400 mt-0.5">
          {showDate
            ? new Date(event.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : formatTime(event.created_at)
          } · {event.created_by_username || 'unknown'}
          {event.logged_at && Math.abs(new Date(event.logged_at) - new Date(event.created_at)) > 5 * 60 * 1000 && (
            <span className="text-amber-400" title="This entry was logged after the fact">
              {' · logged at '}{new Date(event.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>
      <button onClick={() => onDelete(event.id)} className="text-slate-300 hover:text-rose-400 transition-colors p-1 shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Zone config for 5-zone TIR bar
const ZONES = [
  { key: 'veryHigh', label: '>250',    color: '#b91c1c', textColor: 'text-red-700' },
  { key: 'high',     label: 'High',    color: '#eab308', textColor: 'text-yellow-600' },
  { key: 'inRange',  label: 'In Range',color: '#16a34a', textColor: 'text-emerald-700' },
  { key: 'low',      label: 'Low',     color: '#f97316', textColor: 'text-orange-500' },
  { key: 'veryLow',  label: '<54',     color: '#7f1d1d', textColor: 'text-red-900' },
];

function MiniSparkline({ readings, targetLow, targetHigh }) {
  if (!readings || readings.length < 2) {
    return <div className="h-14 flex items-center justify-center text-xs text-slate-300">No data</div>;
  }
  const sorted = [...readings].sort((a, b) => new Date(a.reading_time) - new Date(b.reading_time));
  const W = 200, H = 56;
  const minT = new Date(sorted[0].reading_time).getTime();
  const maxT = new Date(sorted[sorted.length - 1].reading_time).getTime();
  const minV = 40, maxV = 350;
  const px = t => maxT > minT ? ((t - minT) / (maxT - minT)) * W : W / 2;
  const py = v => H - ((Math.min(Math.max(v, minV), maxV) - minV) / (maxV - minV)) * H;
  const rY1 = py(targetHigh);
  const rY2 = py(targetLow);
  const points = sorted.map(r => `${px(new Date(r.reading_time).getTime())},${py(r.value)}`).join(' ');
  const lastVal = sorted[sorted.length - 1].value;
  const lineColor = lastVal < 54 || lastVal > 300 ? '#f43f5e' : lastVal < targetLow || lastVal > targetHigh ? '#f59e0b' : '#10b981';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56 }} preserveAspectRatio="none">
      <rect x={0} y={rY1} width={W} height={Math.max(0, rY2 - rY1)} fill="#10b981" fillOpacity={0.12} />
      <line x1={0} y1={rY1} x2={W} y2={rY1} stroke="#10b981" strokeWidth={0.6} strokeDasharray="3 2" />
      <line x1={0} y1={rY2} x2={W} y2={rY2} stroke="#10b981" strokeWidth={0.6} strokeDasharray="3 2" />
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function DayCard({ day, readings, events, camper, onSelect, selected }) {
  const total = readings.length;
  const inRange = readings.filter(r => r.value >= camper.target_low && r.value <= camper.target_high).length;
  const low = readings.filter(r => r.value < camper.target_low).length;
  const high = readings.filter(r => r.value > camper.target_high).length;
  const tirPct = total ? Math.round((inRange / total) * 100) : null;
  const avg = total ? Math.round(readings.reduce((s, r) => s + r.value, 0) / total) : null;
  const totalCarbs = events.filter(e => e.carbs_g > 0).reduce((s, e) => s + (e.carbs_g || 0), 0);
  const totalInsulin = events.filter(e => (e.dose_given || e.insulin_units) > 0).reduce((s, e) => s + (e.dose_given || e.insulin_units || 0), 0);
  const dateLabel = new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const tirColor = tirPct >= 70 ? 'bg-emerald-100 text-emerald-700' : tirPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return (
    <button
      onClick={() => onSelect(day)}
      className={`text-left rounded-xl border p-3 transition-all w-full ${selected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{dateLabel}</span>
        {tirPct !== null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tirColor}`}>{tirPct}%</span>
        )}
      </div>
      <div className="rounded-lg overflow-hidden bg-slate-50 mb-2.5">
        <MiniSparkline readings={readings} targetLow={camper.target_low} targetHigh={camper.target_high} />
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <div>
          <div className="text-xs font-bold text-slate-700">{avg ?? '–'}</div>
          <div className="text-[10px] text-slate-400">Avg</div>
        </div>
        <div>
          <div className="text-xs font-bold text-rose-500">{low}</div>
          <div className="text-[10px] text-slate-400">Lows</div>
        </div>
        <div>
          <div className="text-xs font-bold text-amber-500">{high}</div>
          <div className="text-[10px] text-slate-400">Highs</div>
        </div>
        <div>
          <div className="text-xs font-bold text-orange-500">{totalCarbs > 0 ? `${totalCarbs}g` : '–'}</div>
          <div className="text-[10px] text-slate-400">Carbs</div>
        </div>
      </div>
      {totalInsulin > 0 && (
        <div className="mt-1.5 text-[10px] text-slate-400 text-center">{totalInsulin.toFixed(1)}u insulin</div>
      )}
    </button>
  );
}

export default function CamperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const hasMedAccess = user?.medical_access || user?.role === 'admin' || user?.role === 'nurse';

  const [camper, setCamper] = useState(null);
  const [readings, setReadings] = useState([]);
  const [events, setEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Time view state
  const [viewMode, setViewMode] = useState('hours'); // 'hours' | 'daily'
  const [hours, setHours] = useState(6);
  const [selectedDay, setSelectedDay] = useState(null);
  const fetchHours = viewMode === 'daily' ? 168 : hours;

  // Treatment form state
  const [bgManual, setBgManual] = useState('');
  const [ketones, setKetones] = useState('');
  const [carbs, setCarbs] = useState('');
  const [calcDose, setCalcDose] = useState('');
  const [doseGiven, setDoseGiven] = useState('');
  const [siteChange, setSiteChange] = useState(false);
  const [prebolus, setPrebolus] = useState(false);
  const [longActingGiven, setLongActingGiven] = useState(false);
  const [basalRate, setBasalRate] = useState('');
  const [note, setNote] = useState('');
  const [mealType, setMealType] = useState(null);
  const [logging, setLogging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [eventTime, setEventTime] = useState('');

  // Daily settings state
  const [dailySettings, setDailySettings] = useState(null);
  const [settingsDate, setSettingsDate] = useState(new Date().toISOString().slice(0, 10));
  const [dsIcr, setDsIcr] = useState('');
  const [dsIsf, setDsIsf] = useState('');
  const [dsTarget, setDsTarget] = useState('');
  const [dsClosedLoop, setDsClosedLoop] = useState(false);
  const [dsLaAm, setDsLaAm] = useState('');
  const [dsLaBed, setDsLaBed] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Derive available days in daily mode
  const availableDays = useMemo(() => {
    if (viewMode !== 'daily') return [];
    return [...new Set(readings.map(r => toLocalDate(r.reading_time)))].sort();
  }, [readings, viewMode]);

  // Group readings/events by day for daily grid
  const dayReadings = useMemo(() => {
    if (viewMode !== 'daily') return {};
    return readings.reduce((acc, r) => {
      const day = toLocalDate(r.reading_time);
      if (!acc[day]) acc[day] = [];
      acc[day].push(r);
      return acc;
    }, {});
  }, [readings, viewMode]);

  const dayEvents = useMemo(() => {
    if (viewMode !== 'daily') return {};
    return events.reduce((acc, e) => {
      const day = toLocalDate(e.created_at);
      if (!acc[day]) acc[day] = [];
      acc[day].push(e);
      return acc;
    }, {});
  }, [events, viewMode]);

  // Filter readings/events for display
  const displayedReadings = (viewMode === 'daily' && selectedDay)
    ? readings.filter(r => toLocalDate(r.reading_time) === selectedDay)
    : readings;
  const displayedEvents = (viewMode === 'daily' && selectedDay)
    ? events.filter(e => toLocalDate(e.created_at) === selectedDay)
    : events;

  // Current view label for headings
  const currentViewLabel = (viewMode === 'daily' && selectedDay)
    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : `${hours}h`;

  // Determine active/next meal
  const now = currentHourDecimal();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter(e => toLocalDate(e.created_at) === todayStr);

  const mealsStatus = MEALS.map(m => {
    const logged = todayEvents.some(e => e.meal_type === m.key);
    const isActive = now >= m.start && now < m.end;
    const isPast = now >= m.end;
    const isUpcoming = now < m.start;
    return { ...m, logged, isActive, isPast, isUpcoming };
  });

  const activeMeal = mealsStatus.find(m => m.isActive && !m.logged);
  const nextMeal = !activeMeal ? mealsStatus.find(m => m.isUpcoming && !m.logged) : null;
  const currentMeal = activeMeal || nextMeal;

  // Medication reminders
  const medReminders = useMemo(() => {
    if (!camper) return [];
    return MED_WINDOWS.map(w => {
      const medNames = w.fields.map(f => camper[f]).filter(Boolean);
      if (medNames.length === 0) return null;
      const logged = todayEvents.some(e => e.med_slot === w.slot);
      const isActive = now >= w.start && now < w.end;
      const isMissed = now >= w.end && !logged;
      return { ...w, medNames, logged, isActive, isMissed };
    }).filter(Boolean);
  }, [camper, todayEvents, now]);

  async function loadEvents() {
    const e = await api.getEvents(id, fetchHours);
    setEvents(e);
  }

  async function load(fh, mode) {
    try {
      const [campers, r, e] = await Promise.all([
        api.getCampers('all'),
        api.getReadings(id, fh),
        api.getEvents(id, fh),
      ]);
      setCamper(campers.find(c => String(c.id) === String(id)) || null);
      setReadings(r);
      setEvents(e);
      if (mode === 'daily' && r.length > 0) {
        const days = [...new Set(r.map(x => toLocalDate(x.reading_time)))].sort();
        setSelectedDay(prev => (prev && days.includes(prev)) ? prev : days[days.length - 1]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(fetchHours, viewMode); }, [id, fetchHours]);

  // Load daily settings when camper or date changes
  useEffect(() => {
    if (!camper) return;
    api.getDailySettingByDate(id, settingsDate).then(ds => {
      setDailySettings(ds);
      setDsIcr(ds?.icr ?? camper.home_icr ?? '');
      setDsIsf(ds?.isf ?? camper.home_isf ?? '');
      setDsTarget(ds?.target_bg ?? camper.home_target_bg ?? 150);
      setDsClosedLoop(ds?.closed_loop ?? camper.closed_loop ?? false);
      setDsLaAm(ds?.long_acting_am ?? camper.home_long_acting_am ?? '');
      setDsLaBed(ds?.long_acting_bed ?? camper.home_long_acting_bed ?? '');
    }).catch(() => {});
  }, [camper?.id, settingsDate]);

  async function handleSync() {
    setSyncing(true);
    try { await api.syncCamper(id); await load(fetchHours, viewMode); }
    finally { setSyncing(false); }
  }

  function selectMeal(meal) {
    setMealType(prev => prev === meal.key ? null : meal.key);
  }

  async function handleQuickCarbs(g, label) {
    setLogging(true);
    try {
      const payload = { carbs_g: g, note: label };
      if (camper.carb_ratio) payload.calc_dose = parseFloat((g / camper.carb_ratio).toFixed(1));
      const event = await api.addEvent(id, payload);
      setEvents(prev => [event, ...prev]);
    } finally { setLogging(false); }
  }

  async function handleLog(e) {
    e.preventDefault();
    const hasData = bgManual || ketones || carbs || calcDose || doseGiven || siteChange || prebolus || longActingGiven || basalRate || note.trim() || mealType;
    if (!hasData) return;
    setLogging(true);
    try {
      const event = await api.addEvent(id, {
        bg_manual: bgManual ? parseInt(bgManual) : null,
        ketones: ketones ? parseFloat(ketones) : null,
        carbs_g: carbs ? parseInt(carbs) : (mealType ? 0 : null),
        calc_dose: calcDose ? parseFloat(calcDose) : null,
        dose_given: doseGiven ? parseFloat(doseGiven) : null,
        site_change: siteChange || false,
        prebolus: prebolus || false,
        long_acting_given: longActingGiven || false,
        basal_rate: basalRate ? parseFloat(basalRate) : null,
        note: note.trim() || null,
        meal_type: mealType || null,
        event_time: eventTime ? new Date(eventTime).toISOString() : null,
      });
      setEvents(prev => [event, ...prev]);
      resetForm();
    } finally { setLogging(false); }
  }

  async function handleMedGiven(slot) {
    setLogging(true);
    try {
      await api.addEvent(id, { med_slot: slot });
      await loadEvents();
    } finally { setLogging(false); }
  }

  function resetForm() {
    setBgManual(''); setKetones(''); setCarbs(''); setCalcDose('');
    setDoseGiven(''); setSiteChange(false); setPrebolus(false);
    setLongActingGiven(false); setBasalRate(''); setNote(''); setMealType(null); setEventTime('');
  }

  async function handleDeleteEvent(eventId) {
    await api.deleteEvent(id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      await api.upsertDailySettings(id, settingsDate, {
        icr: dsIcr || null, isf: dsIsf || null, target_bg: dsTarget || null,
        closed_loop: dsClosedLoop, long_acting_am: dsLaAm || null, long_acting_bed: dsLaBed || null,
      });
    } finally { setSavingSettings(false); }
  }

  function shiftSettingsDate(days) {
    const d = new Date(settingsDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSettingsDate(d.toISOString().slice(0, 10));
  }

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!camper) return <div className="p-8 text-slate-400">Camper not found</div>;

  const isPump = camper.delivery_method === 'pump';
  const status = getGlucoseStatus(camper.latest_value, camper.target_low, camper.target_high);
  const styles = STATUS_STYLES[status];

  // Full CGM stats
  const total = displayedReadings.length;
  const veryLowCount  = displayedReadings.filter(r => r.value < 54).length;
  const lowCount      = displayedReadings.filter(r => r.value >= 54 && r.value < camper.target_low).length;
  const inRange       = displayedReadings.filter(r => r.value >= camper.target_low && r.value <= camper.target_high).length;
  const highCount     = displayedReadings.filter(r => r.value > camper.target_high && r.value <= 250).length;
  const veryHighCount = displayedReadings.filter(r => r.value > 250).length;
  const low  = veryLowCount + lowCount;
  const high = highCount + veryHighCount;
  const tir  = total ? Math.round((inRange / total) * 100) : null;

  const veryLowPct  = total ? Math.round((veryLowCount / total) * 100) : 0;
  const lowPct      = total ? Math.round((lowCount / total) * 100) : 0;
  const inRangePct  = total ? Math.round((inRange / total) * 100) : 0;
  const highPct     = total ? Math.round((highCount / total) * 100) : 0;
  const veryHighPct = total ? Math.round((veryHighCount / total) * 100) : 0;

  const avgGlucose = total ? Math.round(displayedReadings.reduce((s, r) => s + r.value, 0) / total) : 0;
  const stdDev = total && avgGlucose
    ? Math.round(Math.sqrt(displayedReadings.reduce((s, r) => s + Math.pow(r.value - avgGlucose, 2), 0) / total))
    : 0;
  const gmi = avgGlucose ? (3.31 + 0.02392 * avgGlucose).toFixed(1) : '--';
  const cv  = avgGlucose ? Math.round((stdDev / avgGlucose) * 100) : '--';

  const totalCarbsLogged = displayedEvents.filter(e => e.carbs_g > 0).reduce((s, e) => s + (e.carbs_g || 0), 0);
  const totalInsulinGiven = displayedEvents.filter(e => (e.dose_given || e.insulin_units) > 0)
    .reduce((s, e) => s + (e.dose_given || e.insulin_units || 0), 0);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-4 md:mb-5 transition-colors py-1">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header card */}
      <div className={`rounded-2xl p-4 md:p-6 ring-2 mb-4 md:mb-6 ${styles.bg} ${styles.ring}`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">{camper.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {camper.cabin_group && <p className="text-slate-500 text-sm">{camper.cabin_group}</p>}
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isPump ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                {isPump ? 'Pump' : 'Injection'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {camper.cgm_connected ? <Wifi size={18} className="text-emerald-500" /> : <WifiOff size={18} className="text-slate-400" />}
            <button onClick={handleSync} disabled={syncing || !camper.cgm_connected}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors py-1 px-2 rounded-lg">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={async () => {
                const today = new Date();
                const day = today.getDay();
                const diffToSat = day >= 6 ? 0 : day + 1;
                today.setDate(today.getDate() - diffToSat);
                const weekStart = today.toISOString().slice(0, 10);
                setExporting(true);
                try { await api.downloadFlowsheet(id, weekStart); }
                finally { setExporting(false); }
              }}
              disabled={exporting}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors py-1 px-2 rounded-lg"
              title="Download flowsheet CSV"
            >
              <Download size={14} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const day = today.getDay();
                const diffToSat = day >= 6 ? 0 : day + 1;
                today.setDate(today.getDate() - diffToSat);
                const weekStart = today.toISOString().slice(0, 10);
                window.open(`/campers/${id}/print-flowsheet?week_start=${weekStart}`, '_blank');
              }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 rounded-lg"
              title="Print weekly flowsheet"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>
        <div className="mt-4">
          <GlucoseIndicator value={camper.latest_value} trend={camper.latest_trend} targetLow={camper.target_low} targetHigh={camper.target_high} size="lg" />
          <p className="text-slate-500 text-xs mt-1">Last reading: {timeAgo(camper.latest_reading_time)}</p>
          {camper.sync_error && <p className="text-rose-500 text-xs mt-1">Sync error: {camper.sync_error}</p>}
        </div>
      </div>

      {/* Medication reminders */}
      {medReminders.filter(r => !r.logged).length > 0 && (
        <div className="space-y-2 mb-4">
          {medReminders.filter(r => !r.logged).map(r => (
            <div key={r.slot} className={`rounded-xl p-3 flex items-center justify-between ${r.isMissed ? 'bg-rose-50 border border-rose-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div>
                <p className={`text-sm font-medium ${r.isMissed ? 'text-rose-700' : 'text-blue-700'}`}>
                  <Pill size={14} className="inline mr-1.5" />
                  {r.isMissed ? 'MISSED: ' : ''}{r.label} meds due: {r.medNames.join(', ')}
                </p>
              </div>
              <button onClick={() => handleMedGiven(r.slot)} disabled={logging}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${r.isMissed ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
                {r.isMissed ? 'Give Now' : 'Given'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Daily Settings */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Daily Settings</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftSettingsDate(-1)} className="p-1 text-slate-400 hover:text-slate-700"><ChevronLeft size={16} /></button>
            <span className="text-sm text-slate-600 min-w-[100px] text-center">
              {new Date(settingsDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => shiftSettingsDate(1)} className="p-1 text-slate-400 hover:text-slate-700"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-xs text-slate-500 block">ICR</label>
            <input type="number" step="0.1" value={dsIcr} onChange={e => setDsIcr(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block">ISF</label>
            <input type="number" step="1" value={dsIsf} onChange={e => setDsIsf(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block">Target BG</label>
            <input type="number" step="5" value={dsTarget} onChange={e => setDsTarget(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {isPump ? (
          <label className="flex items-center gap-2 text-sm text-slate-600 mb-2">
            <input type="checkbox" checked={dsClosedLoop} onChange={e => setDsClosedLoop(e.target.checked)}
              className="rounded border-slate-300" /> Closed Loop
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-slate-500 block">Long Acting AM</label>
              <input type="number" step="0.5" value={dsLaAm} onChange={e => setDsLaAm(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block">Long Acting BED</label>
              <input type="number" step="0.5" value={dsLaBed} onChange={e => setDsLaBed(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}
        <button onClick={handleSaveSettings} disabled={savingSettings}
          className="w-full py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
          {savingSettings ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* CGM Clinical Summary */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-slate-400" />
              <h2 className="font-semibold text-slate-700">CGM Summary</h2>
            </div>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{total} readings · {currentViewLabel}</span>
          </div>

          {/* TIR + 5-zone bar */}
          <div className="flex gap-5 items-center mb-5">
            {/* Big TIR number */}
            <div className="text-center shrink-0 w-20">
              <div className={`text-5xl font-black leading-none ${inRangePct >= 70 ? 'text-emerald-600' : inRangePct >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>
                {inRangePct}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-wide font-medium">Time in Range</div>
              <div className="text-[10px] text-slate-400">{camper.target_low}–{camper.target_high} mg/dL</div>
            </div>

            {/* 5-zone stacked bar + labels */}
            <div className="flex-1">
              <div className="flex h-7 rounded-lg overflow-hidden shadow-inner bg-slate-100 mb-2">
                {veryHighPct > 0 && <div style={{ width: `${veryHighPct}%`, background: '#b91c1c' }} title={`Very High >250: ${veryHighPct}%`} />}
                {highPct > 0     && <div style={{ width: `${highPct}%`, background: '#eab308' }}     title={`High ${camper.target_high+1}–250: ${highPct}%`} />}
                {inRangePct > 0  && <div style={{ width: `${inRangePct}%`, background: '#16a34a' }}  title={`In Range ${camper.target_low}–${camper.target_high}: ${inRangePct}%`} />}
                {lowPct > 0      && <div style={{ width: `${lowPct}%`, background: '#f97316' }}      title={`Low 54–${camper.target_low-1}: ${lowPct}%`} />}
                {veryLowPct > 0  && <div style={{ width: `${veryLowPct}%`, background: '#7f1d1d' }}  title={`Very Low <54: ${veryLowPct}%`} />}
              </div>
              <div className="grid grid-cols-5 text-center gap-px">
                <div>
                  <div className="text-xs font-bold text-red-800">{veryHighPct}%</div>
                  <div className="text-[9px] text-slate-400">&gt;250</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-yellow-600">{highPct}%</div>
                  <div className="text-[9px] text-slate-400">High</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-700">{inRangePct}%</div>
                  <div className="text-[9px] text-slate-400">In Range</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-orange-500">{lowPct}%</div>
                  <div className="text-[9px] text-slate-400">Low</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-red-900">{veryLowPct}%</div>
                  <div className="text-[9px] text-slate-400">&lt;54</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-slate-100">
            <div className="text-center">
              <div className="text-xl font-black text-slate-800">{avgGlucose}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">Avg Glucose</div>
              <div className="text-[9px] text-slate-300">mg/dL</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-slate-800">{gmi}%</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">GMI</div>
              <div className="text-[9px] text-slate-300">est. A1c</div>
            </div>
            <div className="text-center">
              <div className={`text-xl font-black ${typeof cv === 'number' && cv <= 36 ? 'text-emerald-600' : 'text-amber-500'}`}>{cv}%</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">CV</div>
              <div className="text-[9px] text-slate-300">variability</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-slate-800">±{stdDev}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">Std Dev</div>
              <div className="text-[9px] text-slate-300">mg/dL</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-orange-500">{totalCarbsLogged > 0 ? `${totalCarbsLogged}g` : '—'}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">Carbs</div>
              <div className="text-[9px] text-slate-300">logged</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-blue-500">{totalInsulinGiven > 0 ? `${totalInsulinGiven.toFixed(1)}u` : '—'}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">Insulin</div>
              <div className="text-[9px] text-slate-300">given</div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Glucose History</h2>
          <div className="flex gap-1 flex-wrap justify-end">
            {HOUR_TABS.map(h => (
              <button key={h} onClick={() => { setViewMode('hours'); setHours(h); }}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'hours' && hours === h ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {h}h
              </button>
            ))}
            <button onClick={() => setViewMode(m => m === 'daily' ? 'hours' : 'daily')}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'daily' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
              Daily
            </button>
          </div>
        </div>
        {/* Day picker */}
        {viewMode === 'daily' && availableDays.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {availableDays.map(day => (
              <button key={day} onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedDay === day ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}>
                {formatDayButton(day)}
              </button>
            ))}
          </div>
        )}
        <GlucoseChart readings={displayedReadings} events={displayedEvents} targetLow={camper.target_low} targetHigh={camper.target_high} />
      </div>

      {/* Daily Breakdown Grid */}
      {viewMode === 'daily' && availableDays.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-700">Daily Breakdown</h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full ml-auto">{availableDays.length} days</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {availableDays.slice().reverse().map(day => (
              <DayCard
                key={day}
                day={day}
                readings={dayReadings[day] || []}
                events={dayEvents[day] || []}
                camper={camper}
                onSelect={setSelectedDay}
                selected={selectedDay === day}
              />
            ))}
          </div>
        </div>
      )}

      {/* Meal button */}
      {currentMeal && (
        <div className="mb-4">
          <button onClick={() => selectMeal(currentMeal)} disabled={logging}
            className={`w-full py-4 rounded-xl text-base font-semibold border-2 transition-colors ${
              mealType === currentMeal.key
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
            } disabled:opacity-50`}>
            {currentMeal.isActive ? '' : 'Next: '}{currentMeal.label}
            {mealType === currentMeal.key && ' (selected)'}
          </button>
        </div>
      )}

      {/* Completed meals today */}
      {mealsStatus.filter(m => m.logged).length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {mealsStatus.filter(m => m.logged).map(m => (
            <span key={m.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Check size={10} /> {m.label}
            </span>
          ))}
        </div>
      )}

      {/* Treatment log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
        <h2 className="font-semibold text-slate-700 mb-3">Log Treatment</h2>

        {/* Quick carb buttons */}
        <div className="flex gap-2 mb-3">
          {QUICK_CARBS.map(({ label, g }) => (
            <button key={label} onClick={() => handleQuickCarbs(g, label)} disabled={logging}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-colors">
              {label} · 15g
            </button>
          ))}
        </div>

        {/* Full form */}
        <form onSubmit={handleLog} className="space-y-2">
          {/* Core fields: always visible */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">BG (fingerstick)</label>
              <input type="number" min="0" max="600" value={bgManual} onChange={e => setBgManual(e.target.value)} placeholder="mg/dL"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Carbs (g)</label>
              <input type="number" min="0" max="999" value={carbs}
                onChange={e => {
                  setCarbs(e.target.value);
                  if (camper.carb_ratio && e.target.value) {
                    setCalcDose((parseFloat(e.target.value) / camper.carb_ratio).toFixed(1));
                  }
                }}
                placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {camper.carb_ratio && <p className="text-xs text-slate-400 mt-0.5">1:{camper.carb_ratio}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Dose Given</label>
              <input type="number" min="0" max="99" step="0.1" value={doseGiven} onChange={e => setDoseGiven(e.target.value)}
                onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setDoseGiven(n.toFixed(1)); }}
                placeholder="0.0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* More toggle */}
          <button type="button" onClick={() => setShowMore(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
            {showMore ? '▴ Less' : '▾ More'}
          </button>

          {/* Advanced fields */}
          {showMore && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ketones</label>
                  <input type="number" min="0" max="10" step="0.1" value={ketones} onChange={e => setKetones(e.target.value)} placeholder="mmol/L"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Calc Dose</label>
                  <input type="number" min="0" max="99" step="0.1" value={calcDose} onChange={e => setCalcDose(e.target.value)}
                    placeholder="0.0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {isPump && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Basal Rate (u/hr)</label>
                  <input type="number" min="0" max="10" step="0.025" value={basalRate} onChange={e => setBasalRate(e.target.value)}
                    placeholder="e.g. 0.65" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Time <span className="font-normal text-slate-400">(leave blank for now)</span>
                </label>
                <input
                  type="datetime-local"
                  value={eventTime}
                  max={(() => { const n = new Date(); n.setSeconds(0,0); return new Date(n - n.getTimezoneOffset()*60000).toISOString().slice(0,16); })()}
                  onChange={e => setEventTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-4 py-1">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={siteChange} onChange={e => setSiteChange(e.target.checked)} className="rounded border-slate-300" />
                  Site Change
                </label>
                {isPump ? (
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox" checked={prebolus} onChange={e => setPrebolus(e.target.checked)} className="rounded border-slate-300" />
                    Prebolus
                  </label>
                ) : (
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox" checked={longActingGiven} onChange={e => setLongActingGiven(e.target.checked)} className="rounded border-slate-300" />
                    Long Acting Given
                  </label>
                )}
              </div>
            </>
          )}

          {/* Note — visible only with medical access */}
          {hasMedAccess && (
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Medical note (staff only)" maxLength={200}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          <button type="submit" disabled={logging || (!bgManual && !ketones && !carbs && !calcDose && !doseGiven && !siteChange && !prebolus && !longActingGiven && !basalRate && !note.trim() && !mealType)}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
            {mealType ? `Log ${MEALS.find(m => m.key === mealType)?.label || 'Meal'}` : 'Log Treatment'}
          </button>
        </form>
      </div>

      {/* Event history */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5">
        <h2 className="font-semibold text-slate-700 mb-1">Treatment History ({currentViewLabel})</h2>
        {displayedEvents.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No treatments logged</p>
        ) : (
          <div>
            {displayedEvents.map(event => (
              <EventRow key={event.id} event={event} onDelete={handleDeleteEvent} showDate={viewMode === 'daily' || hours > 24} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
