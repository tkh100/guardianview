import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Line,
  ReferenceLine, ReferenceArea, XAxis, YAxis, Customized,
} from 'recharts';
import { ChevronLeft, ChevronRight, CalendarDays, X, Maximize2 } from 'lucide-react';
import { api } from '../api';

// ─── hourly slot definitions (mirrors PrintFlowsheet) ────────────────────────

const ALL_SLOTS = [
  { id: '12A', hours: [0],       label: '12a' },
  { id: '1A',  hours: [1],       label: '1a'  },
  { id: '2A',  hours: [2],       label: '2a'  },
  { id: 'OVN', hours: [3,4,5,6], label: 'Ovn' },
  { id: '7A',  hours: [7],       label: '7a'  },
  { id: '8A',  hours: [8],       label: '8a'  },
  { id: '9A',  hours: [9],       label: '9a'  },
  { id: '10A', hours: [10],      label: '10a' },
  { id: '11A', hours: [11],      label: '11a' },
  { id: '12P', hours: [12],      label: '12p' },
  { id: '1P',  hours: [13],      label: '1p'  },
  { id: '2P',  hours: [14],      label: '2p'  },
  { id: '3P',  hours: [15],      label: '3p'  },
  { id: '4P',  hours: [16],      label: '4p'  },
  { id: '5P',  hours: [17],      label: '5p'  },
  { id: '6P',  hours: [18],      label: '6p'  },
  { id: '7P',  hours: [19],      label: '7p'  },
  { id: '8P',  hours: [20],      label: '8p'  },
  { id: '9P',  hours: [21],      label: '9p'  },
  { id: '10P', hours: [22],      label: '10p' },
  { id: '11P', hours: [23],      label: '11p' },
];

function buildSlotMap(events, readings) {
  const map = {};
  ALL_SLOTS.forEach(s => {
    map[s.id] = { bgs: [], ketones: [], carbs: [], calcDose: [], doseGiven: [], basalRate: [], siteChange: false, longActing: false, prebolus: false, mealType: null, medSlot: null, notes: [] };
  });
  function slotFor(h) { return ALL_SLOTS.find(s => s.hours.includes(h)); }
  readings.forEach(r => {
    const h = parseTs(r.reading_time).getHours();
    const slot = slotFor(h);
    if (slot) map[slot.id].bgs.push({ val: r.value, cgm: true });
  });
  events.forEach(ev => {
    const h = parseTs(ev.created_at).getHours();
    const slot = slotFor(h);
    if (!slot) return;
    const cell = map[slot.id];
    if (ev.bg_manual   != null) cell.bgs.push({ val: ev.bg_manual, cgm: false });
    if (ev.ketones     != null) cell.ketones.push(ev.ketones);
    if (ev.carbs_g     != null) cell.carbs.push(ev.carbs_g);
    if (ev.calc_dose   != null) cell.calcDose.push(ev.calc_dose);
    if (ev.dose_given  != null) cell.doseGiven.push(ev.dose_given);
    if (ev.basal_rate  != null) cell.basalRate.push(ev.basal_rate);
    if (ev.site_change)         cell.siteChange = true;
    if (ev.long_acting_given)   cell.longActing = true;
    if (ev.prebolus)            cell.prebolus = true;
    if (ev.meal_type)           cell.mealType = ev.meal_type;
    if (ev.med_slot)            cell.medSlot = ev.med_slot;
    if (ev.note)                cell.notes.push(ev.note);
  });
  return map;
}

function fmtNums(arr) {
  if (!arr.length) return null;
  return arr.map(v => (Number.isInteger(v) ? v : parseFloat(v.toFixed(1)))).join(', ');
}

function bgInfo(vals, targetLow, targetHigh) {
  if (!vals.length) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const hasCrit = vals.some(v => v < 55 || v > 300);
  const hasLow  = vals.some(v => v < targetLow);
  const hasHigh = vals.some(v => v > targetHigh);
  const color = hasCrit ? 'text-red-600' : hasLow ? 'text-orange-500' : hasHigh ? 'text-amber-500' : 'text-emerald-600';
  const label = min === max ? String(min) : `${min}–${max}`;
  return { label, color };
}

function HourlyFlowTable({ readings, events, targetLow, targetHigh, isPump }) {
  const slotMap = buildSlotMap(events, readings);
  const activeSlots = ALL_SLOTS.filter(s => {
    const c = slotMap[s.id];
    return c.bgs.length || c.carbs.length || c.doseGiven.length || c.calcDose.length ||
           c.ketones.length || c.basalRate.length || c.siteChange || c.longActing || c.prebolus || c.mealType || c.medSlot;
  });
  if (activeSlots.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Hourly Flow</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide rounded-tl-lg w-10">Time</th>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">CGM</th>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-amber-500 uppercase tracking-wide">FS</th>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Carbs</th>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Calc</th>
              <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Given</th>
              {isPump && <th className="text-center py-1.5 px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Basal</th>}
              <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide rounded-tr-lg">Notes</th>
            </tr>
          </thead>
          <tbody>
            {activeSlots.map((slot, i) => {
              const c = slotMap[slot.id];
              const cgmVals = c.bgs.filter(b =>  b.cgm).map(b => b.val);
              const fsVals  = c.bgs.filter(b => !b.cgm).map(b => b.val);
              const cgm  = bgInfo(cgmVals, targetLow, targetHigh);
              const fs   = bgInfo(fsVals,  targetLow, targetHigh);
              const carbs   = fmtNums(c.carbs);
              const calc    = fmtNums(c.calcDose);
              const given   = fmtNums(c.doseGiven);
              const basal   = fmtNums(c.basalRate);
              const ketones = fmtNums(c.ketones);
              const isEven  = i % 2 === 0;
              return (
                <tr key={slot.id} className={isEven ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="py-1.5 px-2 font-semibold text-slate-600 tabular-nums">{slot.label}</td>
                  <td className="py-1.5 px-1 text-center">
                    {cgm ? <span className={`font-semibold tabular-nums italic ${cgm.color}`}>{cgm.label}</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    {fs ? (
                      <span className="inline-block bg-amber-50 border border-amber-300 text-amber-800 font-bold tabular-nums px-1 rounded text-[11px]">{fs.label}</span>
                    ) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    {carbs ? <span className="font-semibold text-orange-500 tabular-nums">{carbs}g</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    {calc ? <span className="font-medium text-blue-400 tabular-nums">{calc}u</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    {given ? <span className="font-semibold text-blue-600 tabular-nums">{given}u</span> : <span className="text-slate-200">—</span>}
                  </td>
                  {isPump && (
                    <td className="py-1.5 px-1 text-center">
                      {basal ? <span className="font-medium text-indigo-500 tabular-nums">{basal}</span> : <span className="text-slate-200">—</span>}
                    </td>
                  )}
                  <td className="py-1.5 px-2">
                    <div className="flex gap-1 flex-wrap">
                      {c.mealType  && <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[9px] font-medium">{c.mealType}</span>}
                      {c.medSlot   && <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[9px] font-medium">meds</span>}
                      {c.siteChange && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-medium">site chg</span>}
                      {c.longActing && <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[9px] font-medium">long act</span>}
                      {c.prebolus  && <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded text-[9px] font-medium">prebolus</span>}
                      {ketones     && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-medium">ket {ketones}</span>}
                      {c.notes.map((n, ni) => <span key={ni} className="text-slate-400 italic text-[9px]">{n}</span>)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

// Tiny badge overlay (carb pills + manual BG dots) for the mini chart
function MiniBadges({ xAxisMap, yAxisMap, offset, events = [] }) {
  const xScale = Object.values(xAxisMap || {})[0]?.scale;
  const yScale = Object.values(yAxisMap || {})[0]?.scale;
  if (!xScale || !yScale || !events.length) return null;

  const plotLeft  = offset?.left  ?? 0;
  const plotTop   = offset?.top   ?? 0;
  const plotRight = plotLeft + (offset?.width  ?? 0);
  const plotBot   = plotTop  + (offset?.height ?? 0);

  return (
    <g>
      {events.map((e, i) => {
        const x = xScale(parseTs(e.created_at).getTime());
        if (x < plotLeft - 10 || x > plotRight + 10) return null;
        return (
          <g key={i}>
            {e.carbs_g > 0 && (
              <>
                <rect x={x - 10} y={plotTop + 1} width={20} height={11} rx={2} fill="#f97316" />
                <text x={x} y={plotTop + 9} textAnchor="middle" fontSize={7} fill="white" fontWeight="700">
                  {e.carbs_g}g
                </text>
              </>
            )}
            {e.bg_manual > 0 && (() => {
              const y = yScale(e.bg_manual);
              if (y < plotTop || y > plotBot) return null;
              return (
                <>
                  <circle cx={x} cy={y} r={2.5} fill="#f59e0b" stroke="white" strokeWidth={1} />
                  <rect x={x + 3} y={y - 7} width={22} height={11} rx={2} fill="#fef3c7" stroke="#f59e0b" strokeWidth={0.75} />
                  <text x={x + 14} y={y + 1.5} textAnchor="middle" fontSize={7} fill="#92400e" fontWeight="700">
                    {e.bg_manual}
                  </text>
                </>
              );
            })()}
          </g>
        );
      })}
    </g>
  );
}

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

  // Vertical markers for insulin-only events (carbs handled by badges)
  const shortActingMarkers = events
    .filter(e => e.carbs_g === 0 && e.dose_given > 0)
    .map(e => ({ t: parseTs(e.created_at).getTime(), dose: e.dose_given }));
  const longActingMarkers = events
    .filter(e => e.carbs_g === 0 && e.long_acting_given > 0)
    .map(e => ({ t: parseTs(e.created_at).getTime(), dose: e.long_acting_given }));

  const hasBadges = events.some(e => e.carbs_g > 0 || e.bg_manual > 0);

  return (
    <ResponsiveContainer width="100%" height={80}>
      <ComposedChart data={chartData} margin={{ top: hasBadges ? 14 : 4, right: 2, bottom: 0, left: 2 }}>
        <XAxis dataKey="t" type="number" domain={[dayStart, dayEnd]} hide />
        <YAxis domain={[40, 350]} hide />
        <ReferenceArea y1={targetLow} y2={targetHigh} fill="#22c55e" fillOpacity={0.08} />
        <ReferenceLine y={targetLow}  stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" />
        <ReferenceLine y={targetHigh} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" />
        {shortActingMarkers.map(({ t, dose }, i) => (
          <ReferenceLine key={`sa${i}`} x={t} stroke="#3b82f6" strokeWidth={1} strokeOpacity={0.6} strokeDasharray="2 2"
            label={{ value: `${+parseFloat(dose).toFixed(1)}u`, position: 'insideTopRight', fill: '#3b82f6', fontSize: 9, fontWeight: 700 }}
          />
        ))}
        {longActingMarkers.map(({ t, dose }, i) => (
          <ReferenceLine key={`la${i}`} x={t} stroke="#a855f7" strokeWidth={1} strokeOpacity={0.6} strokeDasharray="4 2"
            label={{ value: `${+parseFloat(dose).toFixed(1)}uL`, position: 'insideTopRight', fill: '#a855f7', fontSize: 9, fontWeight: 700 }}
          />
        ))}
        <Customized component={(props) => <MiniBadges {...props} events={events} />} />
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
  const hasCarbs     = event.carbs_g > 0;
  const hasInsulin   = event.dose_given > 0;
  const hasBasal     = event.long_acting_given > 0;
  const hasSiteChg   = event.site_change;
  const hasBG        = event.bg_manual > 0;
  const hasKetones   = event.ketones > 0;
  const hasBasalRate = event.basal_rate > 0;

  return (
    <div className="flex items-center flex-wrap gap-1 text-xs">
      <span className="text-slate-400 w-14 shrink-0 tabular-nums">{fmtTime(event.created_at)}</span>
      {event.meal_type && (
        <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.meal_type}
        </span>
      )}
      {hasBG && (
        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-medium">
          BG {event.bg_manual}
        </span>
      )}
      {hasKetones && (
        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-medium">
          ketones {event.ketones}
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
          long acting
        </span>
      )}
      {hasBasalRate && (
        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-medium">
          {event.basal_rate}u/hr
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

// ─── CamperDetailModal ───────────────────────────────────────────────────────

function CamperDetailModal({ camper: initialCamper, date: initialDate, onClose }) {
  const [modalDate, setModalDate] = useState(initialDate);
  const [camper, setCamper]       = useState(initialCamper);
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    if (modalDate === initialDate) { setCamper(initialCamper); return; }
    setNavLoading(true);
    api.getFlowsheet(modalDate)
      .then(data => {
        const found = data.find(c => c.id === initialCamper.id);
        setCamper(found || { ...initialCamper, readings: [], events: [] });
      })
      .catch(() => setCamper({ ...initialCamper, readings: [], events: [] }))
      .finally(() => setNavLoading(false));
  }, [modalDate]);

  function shiftDay(delta) {
    setModalDate(d => {
      const dt = new Date(d + 'T00:00:00Z');
      dt.setUTCDate(dt.getUTCDate() + delta);
      return dt.toISOString().slice(0, 10);
    });
  }

  const isToday = modalDate >= todayUTC();

  const { readings, events } = camper;
  const values = readings.map(r => r.value);

  const dayStart = Date.UTC(...modalDate.split('-').map((v, i) => i === 1 ? +v - 1 : +v));
  const dayEnd   = dayStart + 86400000;

  const chartData = readings.map(r => ({
    t: parseTs(r.reading_time).getTime(),
    v: r.value,
  }));

  // X-axis ticks every 3 hours
  const ticks = Array.from({ length: 9 }, (_, i) => dayStart + i * 3 * 3600000);
  const fmtHour = (t) => {
    const h = new Date(t).getUTCHours();
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    return h < 12 ? `${h}a` : `${h - 12}p`;
  };

  const hasCritical = values.some(v => v < 55 || v > 300);
  const hasLow      = values.some(v => v < camper.target_low);
  const lineColor   = hasCritical ? '#ef4444' : hasLow ? '#f59e0b' : '#22c55e';

  const carbMarkers    = events.filter(e => e.carbs_g > 0).map(e => ({ t: parseTs(e.created_at).getTime(), carbs: e.carbs_g }));
  const shortActingMarkers = events.filter(e => e.dose_given > 0).map(e => ({ t: parseTs(e.created_at).getTime(), dose: e.dose_given }));
  const longActingMarkers  = events.filter(e => e.long_acting_given > 0).map(e => ({ t: parseTs(e.created_at).getTime(), dose: e.long_acting_given }));

  const s = computeStats(values, camper.target_low, camper.target_high);
  const { avg, tirPct: tir, stdDev, veryLowPct, lowPct, inRangePct, highPct, veryHighPct, veryLowCount, lowCount, highCount, veryHighCount } = s;
  const lows  = veryLowCount + lowCount;
  const highs = highCount + veryHighCount;
  const gmi = avg ? (3.31 + 0.02392 * avg).toFixed(1) : null;
  const cv  = avg && stdDev ? Math.round((stdDev / avg) * 100) : null;
  const totalCarbs   = events.filter(e => e.carbs_g > 0).reduce((a, e) => a + (e.carbs_g || 0), 0);
  const totalInsulin = events.filter(e => e.dose_given > 0).reduce((a, e) => a + (e.dose_given || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <p className="font-bold text-slate-800 text-lg leading-tight">{camper.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {camper.cabin_group && <span className="text-xs text-slate-500">{camper.cabin_group}</span>}
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  camper.delivery_method === 'pump' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
                }`}>{camper.delivery_method}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>
          {/* Day navigation */}
          <div className="flex items-center justify-between px-3 pb-3 border-b border-slate-100">
            <button onClick={() => shiftDay(-1)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-2">
              {navLoading && <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />}
              <span className="text-sm font-semibold text-slate-700 tabular-nums">
                {new Date(modalDate + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <button onClick={() => shiftDay(1)} disabled={isToday} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="px-2 pt-3 shrink-0">
          {readings.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 28, right: 12, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="t" type="number"
                  domain={[dayStart, dayEnd]}
                  ticks={ticks}
                  tickFormatter={fmtHour}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[40, 350]}
                  ticks={[70, 120, 180, 250, 300]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <ReferenceArea y1={camper.target_low} y2={camper.target_high} fill="#22c55e" fillOpacity={0.08} />
                <ReferenceLine y={camper.target_low}  stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" />
                <ReferenceLine y={camper.target_high} stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" />
                {shortActingMarkers.map(({ t, dose }, i) => (
                  <ReferenceLine key={`sa${i}`} x={t} stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="3 3"
                    label={{ value: `${+parseFloat(dose).toFixed(1)}u`, position: 'insideTopRight', fill: '#3b82f6', fontSize: 10, fontWeight: 700 }}
                  />
                ))}
                {longActingMarkers.map(({ t, dose }, i) => (
                  <ReferenceLine key={`la${i}`} x={t} stroke="#a855f7" strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="5 3"
                    label={{ value: `${+parseFloat(dose).toFixed(1)}uL`, position: 'insideTopRight', fill: '#a855f7', fontSize: 10, fontWeight: 700 }}
                  />
                ))}
                <Customized component={(props) => <MiniBadges {...props} events={events} />} />
                <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-300 text-sm">No CGM data for this day</div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-400 px-4 pb-2">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> carbs</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 border-t border-dashed border-blue-400 inline-block" /> insulin</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-500/10 border border-green-200 inline-block rounded-sm" /> target range</span>
          </div>
        </div>

        {/* Stats */}
        {values.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 shrink-0 space-y-2.5">
            {/* TIR + bar */}
            <div className="flex items-center gap-4">
              <div className="text-center shrink-0">
                <div className={`text-3xl font-black leading-none ${tir >= 70 ? 'text-emerald-600' : tir >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>{tir}%</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">Time in Range</div>
              </div>
              <div className="flex-1">
                <TIRBar veryHighPct={veryHighPct} highPct={highPct} inRangePct={inRangePct} lowPct={lowPct} veryLowPct={veryLowPct} height="h-4" />
                <div className="grid grid-cols-5 text-center mt-1 gap-px">
                  <div><span className="text-[9px] font-bold text-red-800">{veryHighPct}%</span><div className="text-[8px] text-slate-400">&gt;250</div></div>
                  <div><span className="text-[9px] font-bold text-yellow-600">{highPct}%</span><div className="text-[8px] text-slate-400">High</div></div>
                  <div><span className="text-[9px] font-bold text-emerald-700">{inRangePct}%</span><div className="text-[8px] text-slate-400">Range</div></div>
                  <div><span className="text-[9px] font-bold text-orange-500">{lowPct}%</span><div className="text-[8px] text-slate-400">Low</div></div>
                  <div><span className="text-[9px] font-bold text-red-900">{veryLowPct}%</span><div className="text-[8px] text-slate-400">&lt;54</div></div>
                </div>
              </div>
            </div>
            {/* Metrics row */}
            <div className="grid grid-cols-6 gap-2 pt-2 border-t border-slate-50 text-center">
              <div><div className="text-sm font-black text-slate-800">{avg}</div><div className="text-[9px] text-slate-400">Avg</div></div>
              <div><div className="text-sm font-black text-slate-800">{gmi}%</div><div className="text-[9px] text-slate-400">GMI</div></div>
              <div><div className={`text-sm font-black ${cv <= 36 ? 'text-emerald-600' : 'text-amber-500'}`}>{cv}%</div><div className="text-[9px] text-slate-400">CV</div></div>
              <div><div className="text-sm font-black text-slate-800">±{stdDev}</div><div className="text-[9px] text-slate-400">SD</div></div>
              <div><div className="text-sm font-black text-orange-500">{totalCarbs > 0 ? `${totalCarbs}g` : '—'}</div><div className="text-[9px] text-slate-400">Carbs</div></div>
              <div><div className="text-sm font-black text-blue-500">{totalInsulin > 0 ? `${totalInsulin.toFixed(1)}u` : '—'}</div><div className="text-[9px] text-slate-400">Insulin</div></div>
            </div>
          </div>
        )}

        {/* Hourly flow table + events */}
        <div className="overflow-auto flex-1 px-5 py-4 space-y-4">
          {(readings.length > 0 || events.length > 0) && (
            <HourlyFlowTable
              readings={readings}
              events={events}
              targetLow={camper.target_low}
              targetHigh={camper.target_high}
              isPump={camper.delivery_method === 'pump'}
            />
          )}
          {events.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">All Events</p>
              <div className="space-y-1.5">
                {events.map((e, i) => <EventRow key={i} event={e} />)}
              </div>
            </div>
          )}
          {events.length === 0 && readings.length === 0 && (
            <p className="text-xs text-slate-300 text-center py-4">No data for this day</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CamperDayCard ───────────────────────────────────────────────────────────

function computeStats(values, targetLow, targetHigh) {
  const total = values.length;
  if (!total) return { total: 0, avg: null, stdDev: null, tirPct: null, veryLowPct: 0, lowPct: 0, inRangePct: 0, highPct: 0, veryHighPct: 0, veryLowCount: 0, lowCount: 0, inRangeCount: 0, highCount: 0, veryHighCount: 0 };
  const veryLowCount  = values.filter(v => v < 54).length;
  const lowCount      = values.filter(v => v >= 54 && v < targetLow).length;
  const inRangeCount  = values.filter(v => v >= targetLow && v <= targetHigh).length;
  const highCount     = values.filter(v => v > targetHigh && v <= 250).length;
  const veryHighCount = values.filter(v => v > 250).length;
  const avg    = Math.round(values.reduce((a, b) => a + b, 0) / total);
  const stdDev = Math.round(Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / total));
  return {
    total,
    avg, stdDev,
    tirPct:      Math.round(inRangeCount  / total * 100),
    veryLowPct:  Math.round(veryLowCount  / total * 100),
    lowPct:      Math.round(lowCount      / total * 100),
    inRangePct:  Math.round(inRangeCount  / total * 100),
    highPct:     Math.round(highCount     / total * 100),
    veryHighPct: Math.round(veryHighCount / total * 100),
    veryLowCount, lowCount, inRangeCount, highCount, veryHighCount,
  };
}

function TIRBar({ veryHighPct, highPct, inRangePct, lowPct, veryLowPct, height = 'h-2.5' }) {
  return (
    <div className={`flex ${height} rounded-full overflow-hidden bg-slate-100`}>
      {veryHighPct > 0 && <div style={{ width: `${veryHighPct}%`, background: '#b91c1c' }} title={`Very High >250: ${veryHighPct}%`} />}
      {highPct     > 0 && <div style={{ width: `${highPct}%`,     background: '#eab308' }} title={`High: ${highPct}%`} />}
      {inRangePct  > 0 && <div style={{ width: `${inRangePct}%`,  background: '#16a34a' }} title={`In Range: ${inRangePct}%`} />}
      {lowPct      > 0 && <div style={{ width: `${lowPct}%`,      background: '#f97316' }} title={`Low: ${lowPct}%`} />}
      {veryLowPct  > 0 && <div style={{ width: `${veryLowPct}%`,  background: '#7f1d1d' }} title={`Very Low <54: ${veryLowPct}%`} />}
    </div>
  );
}

function CamperDayCard({ camper, date, onSelect }) {
  const { readings, events } = camper;
  const values = readings.map(r => r.value);
  const s = computeStats(values, camper.target_low, camper.target_high);

  const totalCarbs   = events.filter(e => e.carbs_g > 0).reduce((a, e) => a + (e.carbs_g || 0), 0);
  const totalInsulin = events.filter(e => e.dose_given > 0).reduce((a, e) => a + (e.dose_given || 0), 0);
  const hasCrit = values.some(v => v < 55 || v > 300);
  const hasLows = (s.veryLowCount + s.lowCount) > 0;

  const accentCls = hasCrit ? 'bg-red-500' : hasLows ? 'bg-amber-400' : 'bg-emerald-500';
  const borderCls = hasCrit ? 'border-red-200' : hasLows ? 'border-amber-200' : 'border-slate-200';

  return (
    <div className={`bg-white rounded-xl border-2 ${borderCls} shadow-sm overflow-hidden flex flex-col`}>
      {/* Status accent bar */}
      <div className={`h-1 ${accentCls}`} />

      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link to={`/campers/${camper.id}`} className="font-bold text-slate-800 hover:text-blue-600 text-sm block truncate leading-snug">
              {camper.name}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              {camper.cabin_group && <span className="text-[11px] text-slate-500">{camper.cabin_group}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${camper.delivery_method === 'pump' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                {camper.delivery_method}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {s.tirPct !== null && (
              <div className={`text-center px-2 py-1 rounded-lg ${s.tirPct >= 70 ? 'bg-emerald-50' : s.tirPct >= 50 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                <div className={`text-lg font-black leading-none tabular-nums ${s.tirPct >= 70 ? 'text-emerald-600' : s.tirPct >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>
                  {s.tirPct}%
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">TIR</div>
              </div>
            )}
            <button onClick={onSelect} className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg hover:bg-slate-50 transition-colors" title="View full day">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        {s.total > 0 && (
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="bg-slate-50 rounded-lg py-1.5">
              <div className="text-sm font-bold text-slate-700 tabular-nums">{s.avg}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">Avg</div>
            </div>
            <div className="bg-slate-50 rounded-lg py-1.5">
              <div className={`text-sm font-bold tabular-nums ${s.stdDev > 50 ? 'text-amber-500' : 'text-slate-700'}`}>±{s.stdDev}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wide">SD</div>
            </div>
          </div>
        )}

        {/* 5-zone TIR bar */}
        {s.total > 0 && (
          <TIRBar
            veryHighPct={s.veryHighPct} highPct={s.highPct} inRangePct={s.inRangePct}
            lowPct={s.lowPct} veryLowPct={s.veryLowPct}
          />
        )}

        {/* Mini chart */}
        <div className="rounded-lg overflow-hidden bg-slate-50">
          <MiniChart
            readings={readings} events={events}
            targetLow={camper.target_low} targetHigh={camper.target_high}
            date={date}
          />
        </div>

        {/* Carbs / insulin totals */}
        {(totalCarbs > 0 || totalInsulin > 0) && (
          <div className="flex gap-2">
            {totalCarbs > 0 && (
              <span className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-semibold">
                {totalCarbs}g carbs
              </span>
            )}
            {totalInsulin > 0 && (
              <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                {totalInsulin.toFixed(1)}u insulin
              </span>
            )}
          </div>
        )}

        {/* Hourly flow table */}
        {(readings.length > 0 || events.length > 0) ? (
          <div className="border-t border-slate-100 pt-2">
            <HourlyFlowTable
              readings={readings}
              events={events}
              targetLow={camper.target_low}
              targetHigh={camper.target_high}
              isPump={camper.delivery_method === 'pump'}
            />
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-2">
            <p className="text-[11px] text-slate-300 text-center py-1">No treatment events</p>
          </div>
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
  const [selectedCamper, setSelectedCamper] = useState(null);
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
            <CamperDayCard key={camper.id} camper={camper} date={date} onSelect={() => setSelectedCamper(camper)} />
          ))}
        </div>
      )}

      {selectedCamper && (
        <CamperDetailModal
          camper={selectedCamper}
          date={date}
          onClose={() => setSelectedCamper(null)}
        />
      )}
    </div>
  );
}
