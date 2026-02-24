import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { api } from '../api';
import GlucoseIndicator, { getGlucoseStatus, STATUS_STYLES } from '../components/GlucoseIndicator';
import GlucoseChart from '../components/GlucoseChart';

const HOURS = [3, 6, 12, 24];
const QUICK_CARBS = [
  { label: '15g NABS', g: 15 },
  { label: '30g', g: 30 },
  { label: '45g', g: 45 },
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
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function EventRow({ event, onDelete }) {
  const parts = [];
  if (event.carbs_g) parts.push(`${event.carbs_g}g carbs`);
  if (event.insulin_units) parts.push(`${event.insulin_units}u insulin`);
  if (event.note) parts.push(event.note);

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 mb-0.5">
          {event.carbs_g && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              {event.carbs_g}g carbs
            </span>
          )}
          {event.insulin_units && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {event.insulin_units}u insulin
            </span>
          )}
        </div>
        {event.note && <p className="text-sm text-slate-600 mt-0.5">{event.note}</p>}
        <p className="text-xs text-slate-400 mt-0.5">
          {formatTime(event.created_at)} · {event.created_by_username || 'unknown'}
        </p>
      </div>
      <button
        onClick={() => onDelete(event.id)}
        className="text-slate-300 hover:text-rose-400 transition-colors p-1 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function CamperDetail() {
  const { id } = useParams();
  const [camper, setCamper] = useState(null);
  const [readings, setReadings] = useState([]);
  const [events, setEvents] = useState([]);
  const [hours, setHours] = useState(6);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Log form state
  const [carbs, setCarbs] = useState('');
  const [insulin, setInsulin] = useState('');
  const [note, setNote] = useState('');
  const [logging, setLogging] = useState(false);

  async function load() {
    try {
      const [campers, r, e] = await Promise.all([
        api.getCampers('all'),
        api.getReadings(id, hours),
        api.getEvents(id, hours),
      ]);
      setCamper(campers.find(c => String(c.id) === String(id)) || null);
      setReadings(r);
      setEvents(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, hours]);

  async function handleSync() {
    setSyncing(true);
    try {
      await api.syncCamper(id);
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleQuickCarbs(g) {
    setLogging(true);
    try {
      const event = await api.addEvent(id, { carbs_g: g });
      setEvents(prev => [event, ...prev]);
    } finally {
      setLogging(false);
    }
  }

  async function handleLog(e) {
    e.preventDefault();
    if (!carbs && !insulin && !note.trim()) return;
    setLogging(true);
    try {
      const event = await api.addEvent(id, {
        carbs_g: carbs ? parseInt(carbs) : null,
        insulin_units: insulin ? parseFloat(insulin) : null,
        note: note.trim() || null,
      });
      setEvents(prev => [event, ...prev]);
      setCarbs('');
      setInsulin('');
      setNote('');
    } finally {
      setLogging(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    await api.deleteEvent(id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!camper) return <div className="p-8 text-slate-400">Camper not found</div>;

  const status = getGlucoseStatus(camper.latest_value, camper.target_low, camper.target_high);
  const styles = STATUS_STYLES[status];

  // Time-in-range stats
  const total = readings.length;
  const inRange = readings.filter(r => r.value >= camper.target_low && r.value <= camper.target_high).length;
  const low = readings.filter(r => r.value < camper.target_low).length;
  const high = readings.filter(r => r.value > camper.target_high).length;
  const tir = total ? Math.round((inRange / total) * 100) : null;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-4 md:mb-5 transition-colors py-1">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* Header card */}
      <div className={`rounded-2xl p-4 md:p-6 ring-2 mb-4 md:mb-6 ${styles.bg} ${styles.ring}`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">{camper.name}</h1>
            {camper.cabin_group && <p className="text-slate-500 text-sm">{camper.cabin_group}</p>}
          </div>
          <div className="flex items-center gap-3">
            {camper.cgm_connected ? (
              <Wifi size={18} className="text-emerald-500" />
            ) : (
              <WifiOff size={18} className="text-slate-400" />
            )}
            <button
              onClick={handleSync}
              disabled={syncing || !camper.cgm_connected}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors py-1 px-2 rounded-lg"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <GlucoseIndicator
            value={camper.latest_value}
            trend={camper.latest_trend}
            targetLow={camper.target_low}
            targetHigh={camper.target_high}
            size="lg"
          />
          <p className="text-slate-500 text-xs mt-1">
            Last reading: {timeAgo(camper.latest_reading_time)}
          </p>
          {camper.sync_error && (
            <p className="text-rose-500 text-xs mt-1">Sync error: {camper.sync_error}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Glucose History</h2>
          <div className="flex gap-1">
            {HOURS.map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hours === h ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <GlucoseChart readings={readings} targetLow={camper.target_low} targetHigh={camper.target_high} />
      </div>

      {/* Time in range stats */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
          <h2 className="font-semibold text-slate-700 mb-4">Time in Range ({hours}h)</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{tir}%</p>
              <p className="text-xs text-slate-500 mt-0.5">In Range</p>
              <p className="text-xs text-slate-400">{camper.target_low}–{camper.target_high}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{total ? Math.round((low / total) * 100) : 0}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Below Range</p>
              <p className="text-xs text-slate-400">&lt; {camper.target_low}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{total ? Math.round((high / total) * 100) : 0}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Above Range</p>
              <p className="text-xs text-slate-400">&gt; {camper.target_high}</p>
            </div>
          </div>
        </div>
      )}

      {/* Treatment log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
        <h2 className="font-semibold text-slate-700 mb-3">Log Treatment</h2>

        {/* Quick carb buttons */}
        <div className="flex gap-2 mb-3">
          {QUICK_CARBS.map(({ label, g }) => (
            <button
              key={g}
              onClick={() => handleQuickCarbs(g)}
              disabled={logging}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Full form */}
        <form onSubmit={handleLog} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Carbs (g)</label>
              <input
                type="number"
                min="0"
                max="999"
                value={carbs}
                onChange={e => setCarbs(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Insulin (units)</label>
              <input
                type="number"
                min="0"
                max="99"
                step="0.5"
                value={insulin}
                onChange={e => setInsulin(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={200}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={logging || (!carbs && !insulin && !note.trim())}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            Log
          </button>
        </form>
      </div>

      {/* Event history */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5">
        <h2 className="font-semibold text-slate-700 mb-1">Treatment History ({hours}h)</h2>
        {events.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No treatments logged</p>
        ) : (
          <div>
            {events.map(event => (
              <EventRow key={event.id} event={event} onDelete={handleDeleteEvent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
