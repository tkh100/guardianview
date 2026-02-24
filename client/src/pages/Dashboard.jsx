import { useState, useEffect, useCallback } from 'react';
import { Users, Activity, AlertTriangle, TrendingDown, RefreshCw } from 'lucide-react';
import { api } from '../api';
import CamperCard from '../components/CamperCard';
import AlertsPanel from '../components/AlertsPanel';
import { getGlucoseStatus } from '../components/GlucoseIndicator';

function getUser() {
  try { return JSON.parse(localStorage.getItem('gv_user') || 'null'); } catch { return null; }
}

function StatCard({ icon: Icon, label, value, color = 'text-slate-700' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-slate-400" />
        <span className="text-slate-500 text-sm">{label}</span>
      </div>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const user = getUser();
  const [campers, setCampers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState(
    user?.role === 'counselor' ? (user.cabin_group || 'all') : 'all'
  );
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([
        api.getCampers(groupFilter),
        api.getAlerts(),
      ]);
      setCampers(c);
      setAlerts(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Stats
  const total = campers.length;
  const inRange = campers.filter(c => getGlucoseStatus(c.latest_value, c.target_low, c.target_high) === 'normal').length;
  const critical = campers.filter(c => {
    const s = getGlucoseStatus(c.latest_value, c.target_low, c.target_high);
    return s === 'critical_low' || s === 'critical_high';
  }).length;
  const outOfRange = campers.filter(c => {
    const s = getGlucoseStatus(c.latest_value, c.target_low, c.target_high);
    return s !== 'normal' && s !== 'nodata';
  }).length;

  // Cabin groups for filter
  const cabinGroups = [...new Set(campers.map(c => c.cabin_group).filter(Boolean))].sort();

  // Filtered/searched campers
  const visible = campers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cabin_group || '').toLowerCase().includes(search.toLowerCase())
  );

  // Sort: critical first, then low/high, then normal, then no data
  const ORDER = { critical_low: 0, critical_high: 1, low: 2, high: 3, normal: 4, nodata: 5 };
  const sorted = [...visible].sort((a, b) => {
    const sa = ORDER[getGlucoseStatus(a.latest_value, a.target_low, a.target_high)] ?? 5;
    const sb = ORDER[getGlucoseStatus(b.latest_value, b.target_low, b.target_high)] ?? 5;
    return sa - sb || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
              <p className="text-slate-500 text-sm">{total} camper{total !== 1 ? 's' : ''} monitored</p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Users} label="Total" value={total} />
            <StatCard icon={Activity} label="In Range" value={inRange} color="text-emerald-600" />
            <StatCard icon={AlertTriangle} label="Out of Range" value={outOfRange} color="text-amber-600" />
            <StatCard icon={TrendingDown} label="Critical" value={critical} color="text-rose-600" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input
              type="search"
              placeholder="Search campers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setGroupFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                All
              </button>
              {cabinGroups.map(g => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupFilter === g ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Camper grid */}
          {loading ? (
            <div className="text-center py-20 text-slate-400">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No campers found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sorted.map(c => <CamperCard key={c.id} camper={c} />)}
            </div>
          )}
        </div>
      </div>

      {/* Alerts sidebar */}
      <div className="w-72 shrink-0 border-l border-slate-200 p-4 overflow-auto">
        <AlertsPanel
          alerts={alerts}
          onAcknowledge={id => setAlerts(prev => prev.filter(a => a.id !== id))}
        />
      </div>
    </div>
  );
}
