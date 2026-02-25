import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Line,
  ReferenceLine, ReferenceArea, XAxis, YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '../api';

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

// Parse a stored timestamp to a JS Date (handles both ISO "T…Z" and SQLite "YYYY-MM-DD HH:MM:SS")
function parseTs(ts) {
  return new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
}

function fmtTime(ts) {
  return parseTs(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── MiniChart ───────────────────────────────────────────────────────────────

function MiniChart({ readings, events, targetLow, targetHigh, date }) {
  if (readings.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-slate-300 text-xs">
        No CGM data
      </div>
    );
  }

  const dayStart = Date.UTC(...date.split('-').map((v, i) => i === 1 ? +v - 1 : +v));
  const dayEnd   = dayStart + 86400000;

  const chartData = readings.map(r => ({
    t: parseTs(r.reading_time).getTime(),
    v: r.value,
  }));

  const values = chartData.map(d => d.v);
  const hasCritical = values.some(v => v < 55 || v > 300);
  const hasLow      = values.some(v => v < targetLow);
  const lineColor   = hasCritical ? '#ef4444' : hasLow ? '#f59e0b' : '#22c55e';

  // One vertical marker per event — orange for carbs, blue for insulin
  const markers = events
    .filter(e => e.carbs_g > 0 || e.dose_given > 0 || e.long_acting_given > 0)
    .map(e => ({
      t: parseTs(e.created_at).getTime(),
      color: e.carbs_g > 0 ? '#f97316' : '#3b82f6',
    }));

  return (
    <ResponsiveContainer width="100%" height={80}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <XAxis dataKey="t" type="number" domain={[dayStart, dayEnd]} hide />
        <YAxis domain={[40, 350]} hide />
        <ReferenceArea y1={targetLow} y2={targetHigh} fill="#22c55e" fillOpacity={0.08} />
        <ReferenceLine y={targetLow}  stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" />
        <ReferenceLine y={targetHigh} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" />
        {markers.map((m, i) => (
          <ReferenceLine key={i} x={m.t} stroke={m.color} strokeWidth={1} strokeOpacity={0.6} strokeDasharray="2 2" />
        ))}
        <Line
          type="monotone"
          dataKey="v"
          stroke={lineColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

function EventRow({ event }) {
  const hasCarbs    = event.carbs_g > 0;
  const hasInsulin  = event.dose_given > 0;
  const hasBasal    = event.long_acting_given > 0;
  const hasSiteChg  = event.site_change;

  return (
    <div className="flex items-center flex-wrap gap-1 text-xs">
      <span className="text-slate-400 w-14 shrink-0 tabular-nums">{fmtTime(event.created_at)}</span>
      {event.meal_type && (
        <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.meal_type}
        </span>
      )}
      {hasCarbs && (
        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.carbs_g}g carbs
        </span>
      )}
      {hasInsulin && (
        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.dose_given}u insulin
        </span>
      )}
      {hasBasal && (
        <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.long_acting_given}u basal
        </span>
      )}
      {hasSiteChg && (
        <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium">
          site change
        </span>
      )}
      {event.note && (
        <span className="text-slate-400 italic truncate max-w-[12rem]">{event.note}</span>
      )}
    </div>
  );
}

// ─── CamperDayCard ───────────────────────────────────────────────────────────

function CamperDayCard({ camper, date }) {
  const { readings, events } = camper;
  const values = readings.map(r => r.value);

  const avg    = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const inRange = values.filter(v => v >= camper.target_low && v <= camper.target_high).length;
  const tirPct  = values.length ? Math.round(inRange / values.length * 100) : null;
  const lows    = values.filter(v => v < camper.target_low).length;
  const highs   = values.filter(v => v > camper.target_high).length;
  const hasCrit = values.some(v => v < 55 || v > 300);

  const borderCls = hasCrit
    ? 'border-red-300 bg-red-50/30'
    : lows > 2
    ? 'border-amber-300 bg-amber-50/20'
    : 'border-slate-200';

  return (
    <div className={`bg-white rounded-xl border-2 ${borderCls} p-4 shadow-sm flex flex-col gap-2`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={`/campers/${camper.id}`}
            className="font-semibold text-slate-800 hover:text-blue-600 text-sm leading-snug"
          >
            {camper.name}
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            {camper.cabin_group && (
              <span className="text-xs text-slate-500 font-medium">{camper.cabin_group}</span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              camper.delivery_method === 'pump'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-violet-50 text-violet-600'
            }`}>
              {camper.delivery_method}
            </span>
          </div>
        </div>
        {avg !== null && (
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-slate-800 tabular-nums">{avg}</div>
            <div className="text-xs text-slate-400">avg mg/dL</div>
          </div>
        )}
      </div>

      {/* Sparkline */}
      <MiniChart
        readings={readings}
        events={events}
        targetLow={camper.target_low}
        targetHigh={camper.target_high}
        date={date}
      />

      {/* Stats row */}
      {values.length > 0 && (
        <div className="flex items-center gap-3 text-xs -mt-1">
          {tirPct !== null && (
            <span className="text-emerald-600 font-semibold">{tirPct}% in range</span>
          )}
          {lows > 0 && (
            <span className="text-amber-600 font-semibold">{lows} low{lows !== 1 ? 's' : ''}</span>
          )}
          {highs > 0 && (
            <span className="text-slate-500">{highs} high{highs !== 1 ? 's' : ''}</span>
          )}
          <span className="text-slate-300 ml-auto">{values.length} readings</span>
        </div>
      )}

      {/* Events */}
      <div className="border-t pt-2 space-y-1">
        {events.length > 0 ? (
          events.map((e, i) => <EventRow key={i} event={e} />)
        ) : (
          <p className="text-xs text-slate-300">No treatment events</p>
        )}
      </div>
    </div>
  );
}

// ─── Flowsheet page ──────────────────────────────────────────────────────────

export default function Flowsheet() {
  const [date, setDate]           = useState(todayUTC);
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [groupFilter, setGroupFilter] = useState('all');
  const today = todayUTC();

  useEffect(() => {
    setLoading(true);
    api.getFlowsheet(date)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [date]);

  const groups = [...new Set(data.map(c => c.cabin_group).filter(Boolean))].sort();
  const visible = groupFilter === 'all' ? data : data.filter(c => c.cabin_group === groupFilter);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-blue-500 w-5 h-5" />
          <h1 className="text-xl font-bold text-slate-800">Day Sheet</h1>
        </div>

        {/* Date navigator */}
        <div className="flex items-center bg-white border rounded-lg overflow-hidden shadow-sm">
          <button
            onClick={() => setDate(d => addDays(d, -1))}
            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="text-sm text-slate-700 font-medium px-1 border-none outline-none bg-transparent"
          />
          <button
            onClick={() => setDate(d => d < today ? addDays(d, 1) : d)}
            disabled={date >= today}
            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="text-sm text-slate-500">{fmtDate(date)}</span>

        {/* Group filter */}
        {groups.length > 0 && (
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-slate-700 shadow-sm"
          >
            <option value="all">All Groups</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}

        {!loading && (
          <span className="text-sm text-slate-400 ml-auto">{visible.length} camper{visible.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-orange-400 inline-block" /> carbs event
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-400 inline-block" /> insulin event
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-green-500/10 border border-green-200 inline-block rounded-sm" /> target range
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-52 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-20 bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center text-slate-400 py-16">
          No active campers found
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(camper => (
            <CamperDayCard key={camper.id} camper={camper} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}
