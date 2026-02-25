import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import GlucoseChart from '../components/GlucoseChart';
import { getGlucoseStatus, STATUS_STYLES } from '../components/GlucoseIndicator';

const TREND_ARROWS = {
  DoubleUp: '↑↑', SingleUp: '↑', FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '↓↓',
};

function timeAgo(iso) {
  if (!iso) return 'No data';
  const mins = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function toLocalDate(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayTab(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function getTirBadge(tir) {
  if (tir == null) return 'bg-slate-100 text-slate-400';
  if (tir >= 70) return 'bg-emerald-100 text-emerald-700';
  if (tir >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function Trends() {
  const [trendsData, setTrendsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Drill-down state
  const [drillReadings, setDrillReadings] = useState([]);
  const [drillEvents, setDrillEvents] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // Daily settings
  const [dsIcr, setDsIcr] = useState('');
  const [dsIsf, setDsIsf] = useState('');
  const [dsTarget, setDsTarget] = useState('');
  const [dsClosedLoop, setDsClosedLoop] = useState(false);
  const [dsLaAm, setDsLaAm] = useState('');
  const [dsLaBed, setDsLaBed] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadTrends() {
    try {
      const data = await api.getTrends();
      setTrendsData(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTrends(); }, []);

  const selectedCamper = trendsData.find(c => c.id === selectedId) || null;

  async function loadDrillDown(camperId) {
    setDrillLoading(true);
    setDrillReadings([]);
    setDrillEvents([]);
    try {
      const [r, e] = await Promise.all([
        api.getReadings(camperId, 168),
        api.getEvents(camperId, 168),
      ]);
      setDrillReadings(r);
      setDrillEvents(e);
      const days = [...new Set(r.map(x => toLocalDate(x.reading_time)))].sort();
      setSelectedDay(days[days.length - 1] || null);
    } finally {
      setDrillLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) loadDrillDown(selectedId);
  }, [selectedId]);

  // Load daily settings when camper or day changes
  useEffect(() => {
    if (!selectedCamper || !selectedDay) return;
    api.getDailySettingByDate(selectedCamper.id, selectedDay).then(ds => {
      setDsIcr(ds?.icr ?? selectedCamper.home_icr ?? '');
      setDsIsf(ds?.isf ?? selectedCamper.home_isf ?? '');
      setDsTarget(ds?.target_bg ?? selectedCamper.home_target_bg ?? 150);
      setDsClosedLoop(ds?.closed_loop ?? selectedCamper.closed_loop ?? false);
      setDsLaAm(ds?.long_acting_am ?? selectedCamper.home_long_acting_am ?? '');
      setDsLaBed(ds?.long_acting_bed ?? selectedCamper.home_long_acting_bed ?? '');
    }).catch(() => {});
  }, [selectedCamper?.id, selectedDay]);

  // Available days descending
  const availableDays = useMemo(() => {
    return [...new Set(drillReadings.map(r => toLocalDate(r.reading_time)))].sort().reverse();
  }, [drillReadings]);

  // Day-filtered data
  const dayReadings = selectedDay ? drillReadings.filter(r => toLocalDate(r.reading_time) === selectedDay) : [];
  const dayEvents = selectedDay ? drillEvents.filter(e => toLocalDate(e.created_at) === selectedDay) : [];

  // Day stats
  const total = dayReadings.length;
  const inRange = selectedCamper
    ? dayReadings.filter(r => r.value >= selectedCamper.target_low && r.value <= selectedCamper.target_high).length
    : 0;
  const dayTir = total ? Math.round((inRange / total) * 100) : null;
  const dayAvg = total ? Math.round(dayReadings.reduce((s, r) => s + r.value, 0) / total) : null;
  const dayHigh = total ? Math.max(...dayReadings.map(r => r.value)) : null;
  const dayLow = total ? Math.min(...dayReadings.map(r => r.value)) : null;

  async function handleSaveSettings() {
    if (!selectedCamper || !selectedDay) return;
    setSavingSettings(true);
    try {
      await api.upsertDailySettings(selectedCamper.id, selectedDay, {
        icr: dsIcr || null, isf: dsIsf || null, target_bg: dsTarget || null,
        closed_loop: dsClosedLoop,
        long_acting_am: dsLaAm || null, long_acting_bed: dsLaBed || null,
      });
    } finally {
      setSavingSettings(false);
    }
  }

  const isPump = selectedCamper?.delivery_method === 'pump';

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Left: Overview list */}
      <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 overflow-auto">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">Daily Trends</h1>
            {lastUpdated && (
              <p className="text-xs text-slate-400 mt-0.5">
                Updated {timeAgo(lastUpdated.toISOString())}
              </p>
            )}
          </div>
          <button onClick={loadTrends} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trendsData.map(c => {
              const status = getGlucoseStatus(c.latest_value, c.target_low, c.target_high);
              const styles = STATUS_STYLES[status];
              const isSelected = c.id === selectedId;
              const arrow = TREND_ARROWS[c.latest_trend] || '';
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 ${isSelected ? 'border-l-4 border-blue-500 bg-blue-50/50' : 'border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                      {c.cabin_group && <p className="text-xs text-slate-400">{c.cabin_group}</p>}
                    </div>
                    <div className={`text-right ${styles.text}`}>
                      <span className="text-xl font-bold">{c.latest_value ?? '--'}</span>
                      <span className="text-sm ml-0.5">{arrow}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.tir_today != null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTirBadge(c.tir_today)}`}>
                        {c.tir_today}% TIR
                      </span>
                    )}
                    {c.avg_today != null && (
                      <span className="text-xs text-slate-400">avg {c.avg_today}</span>
                    )}
                  </div>
                  {c.tir_7day != null && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.tir_7day >= 70 ? 'bg-emerald-500' : c.tir_7day >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${c.tir_7day}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{c.tir_7day}% 7d</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Drill-down */}
      <div className="flex-1 overflow-auto">
        {!selectedCamper ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Select a camper to view details</p>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-800">{selectedCamper.name}</h2>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isPump ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                {isPump ? 'Pump' : 'Injection'}
              </span>
            </div>

            {/* Day tabs */}
            {drillLoading ? (
              <p className="text-slate-400 text-sm mb-4">Loading data...</p>
            ) : (
              <>
                {availableDays.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {availableDays.map(day => (
                      <button key={day} onClick={() => setSelectedDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selectedDay === day ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}>
                        {formatDayTab(day)}
                      </button>
                    ))}
                  </div>
                )}

                {selectedDay && (
                  <>
                    {/* Day stats */}
                    {total > 0 && (
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: 'TIR', value: dayTir != null ? `${dayTir}%` : '--', color: getTirBadge(dayTir) },
                          { label: 'Avg', value: dayAvg ?? '--' },
                          { label: 'High', value: dayHigh ?? '--' },
                          { label: 'Low', value: dayLow ?? '--' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <p className={`text-lg font-bold ${color ? '' : 'text-slate-800'} ${color || ''}`}>{value}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                      <GlucoseChart
                        readings={dayReadings}
                        events={dayEvents}
                        targetLow={selectedCamper.target_low}
                        targetHigh={selectedCamper.target_high}
                      />
                    </div>

                    {/* Daily settings */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="font-semibold text-slate-700 text-sm mb-3">
                        Daily Settings — {formatDayTab(selectedDay)}
                      </h3>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">ICR</label>
                          <input type="number" step="0.1" value={dsIcr} onChange={e => setDsIcr(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">ISF</label>
                          <input type="number" step="1" value={dsIsf} onChange={e => setDsIsf(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Target BG</label>
                          <input type="number" step="5" value={dsTarget} onChange={e => setDsTarget(e.target.value)} className={inputCls} />
                        </div>
                      </div>
                      {isPump ? (
                        <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                          <input type="checkbox" checked={dsClosedLoop} onChange={e => setDsClosedLoop(e.target.checked)} className="rounded border-slate-300" />
                          Closed Loop
                        </label>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Long Acting AM</label>
                            <input type="number" step="0.5" value={dsLaAm} onChange={e => setDsLaAm(e.target.value)} className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Long Acting BED</label>
                            <input type="number" step="0.5" value={dsLaBed} onChange={e => setDsLaBed(e.target.value)} className={inputCls} />
                          </div>
                        </div>
                      )}
                      <button onClick={handleSaveSettings} disabled={savingSettings}
                        className="w-full py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
                        {savingSettings ? 'Saving...' : `Save for ${formatDayTab(selectedDay)}`}
                      </button>
                    </div>
                  </>
                )}

                {availableDays.length === 0 && !drillLoading && (
                  <p className="text-slate-400 text-sm">No glucose data available for this camper.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
