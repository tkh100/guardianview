import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api } from '../api';
import GlucoseIndicator, { getGlucoseStatus, STATUS_STYLES } from '../components/GlucoseIndicator';
import GlucoseChart from '../components/GlucoseChart';

const HOURS = [3, 6, 12, 24];

function timeAgo(iso) {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function CamperDetail() {
  const { id } = useParams();
  const [camper, setCamper] = useState(null);
  const [readings, setReadings] = useState([]);
  const [hours, setHours] = useState(6);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [campers, r] = await Promise.all([
        api.getCampers('all'),
        api.getReadings(id, hours),
      ]);
      setCamper(campers.find(c => String(c.id) === String(id)) || null);
      setReadings(r);
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
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* Header card */}
      <div className={`rounded-2xl p-6 ring-2 mb-6 ${styles.bg} ${styles.ring}`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{camper.name}</h1>
            {camper.cabin_group && <p className="text-slate-500 text-sm">{camper.cabin_group}</p>}
          </div>
          <div className="flex items-center gap-2">
            {camper.cgm_connected ? (
              <Wifi size={16} className="text-emerald-500" />
            ) : (
              <WifiOff size={16} className="text-slate-400" />
            )}
            <button
              onClick={handleSync}
              disabled={syncing || !camper.cgm_connected}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700">Glucose History</h2>
          <div className="flex gap-1">
            {HOURS.map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
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
    </div>
  );
}
