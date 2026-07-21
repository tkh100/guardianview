import { useState, useEffect, useCallback } from 'react';
import { Users, Activity, AlertTriangle, TrendingDown, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import CamperCard from '../components/CamperCard';
import AlertsPanel from '../components/AlertsPanel';
import { getGlucoseStatus } from '../components/GlucoseIndicator';
import { useAudioAlerts } from '../hooks/useAudioAlerts';

function getUser() {
  try { return JSON.parse(localStorage.getItem('gv_user') || 'null'); } catch { return null; }
}

const STAT_THEMES = {
  slate:   { icon: 'bg-slate-100 text-slate-500', value: 'text-slate-800' },
  emerald: { icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-600' },
  amber:   { icon: 'bg-amber-100 text-amber-600', value: 'text-amber-600' },
  rose:    { icon: 'bg-rose-100 text-rose-600', value: 'text-rose-600' },
};

function StatCard({ icon: Icon, label, value, theme = 'slate' }) {
  const t = STAT_THEMES[theme];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft px-4 py-3.5 md:px-5 md:py-4 flex items-center gap-3.5 transition-shadow hover:shadow-card">
      <span className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className={`text-2xl md:text-3xl font-bold leading-tight tabular-nums ${t.value}`}>{value}</p>
        <span className="text-slate-400 text-xs md:text-sm font-medium truncate block">{label}</span>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft px-4 py-3.5 md:px-5 md:py-4 flex items-center gap-3.5">
      <span className="w-9 h-9 md:w-10 md:h-10 rounded-xl skeleton shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-6 w-12 rounded skeleton" />
        <div className="h-3 w-16 rounded skeleton" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-4 border border-slate-200 bg-white">
      <div className="h-3.5 w-3/4 rounded skeleton mb-2" />
      <div className="h-2.5 w-1/3 rounded skeleton mb-4" />
      <div className="h-8 w-16 rounded skeleton mb-2" />
      <div className="h-2.5 w-1/2 rounded skeleton" />
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

  // Audio alerts for critical BG
  useAudioAlerts(alerts);

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
    <div className="flex flex-col md:flex-row h-full">
      {/* Main area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-pine-500 to-pine-700 flex items-center justify-center shadow-glow shrink-0 md:hidden">
                <ShieldCheck size={17} className="text-white" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-display font-bold text-slate-800 tracking-tight">Dashboard</h1>
                <p className="text-slate-500 text-sm">{total} camper{total !== 1 ? 's' : ''} monitored</p>
              </div>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-white transition-colors p-2 -mr-2 rounded-lg"
            >
              <RefreshCw size={15} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            {loading ? (
              <>
                <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
              </>
            ) : (
              <>
                <StatCard icon={Users} label="Total" value={total} theme="slate" />
                <StatCard icon={Activity} label="In Range" value={inRange} theme="emerald" />
                <StatCard icon={AlertTriangle} label="Out of Range" value={outOfRange} theme="amber" />
                <StatCard icon={TrendingDown} label="Critical" value={critical} theme="rose" />
              </>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-5">
            <div className="relative w-full sm:w-56">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search campers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pine-400 focus:border-pine-400 transition-colors"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap overflow-x-auto no-scrollbar">
              <button
                onClick={() => setGroupFilter('all')}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${groupFilter === 'all' ? 'bg-slate-800 text-white shadow-soft' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                All
              </button>
              {cabinGroups.map(g => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${groupFilter === g ? 'bg-slate-800 text-white shadow-soft' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Camper grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Users size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No campers found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try a different search or filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sorted.map(c => <CamperCard key={c.id} camper={c} />)}
            </div>
          )}
        </div>

        {/* Alerts — mobile: inline below grid */}
        <div className="md:hidden border-t border-slate-200 p-4">
          <AlertsPanel
            alerts={alerts}
            onAcknowledge={id => setAlerts(prev => prev.filter(a => a.id !== id))}
          />
        </div>
      </div>

      {/* Alerts sidebar — desktop only */}
      <div className="hidden md:block w-72 shrink-0 border-l border-slate-200 p-4 overflow-auto">
        <AlertsPanel
          alerts={alerts}
          onAcknowledge={id => setAlerts(prev => prev.filter(a => a.id !== id))}
        />
      </div>
    </div>
  );
}
