import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Customized,
} from 'recharts';

function formatTimeOnly(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
    d.toLocaleTimeString([], { hour: 'numeric' });
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs">{formatTimeOnly(d.ts)}</p>
      <p className="text-slate-800 font-bold text-lg">{d.value} <span className="text-xs font-normal text-slate-400">mg/dL</span></p>
    </div>
  );
};

// SVG overlay: carb pills at top + manual BG badges at actual value
function EventBadges({ xAxisMap, yAxisMap, offset, events = [] }) {
  const xScale = Object.values(xAxisMap || {})[0]?.scale;
  const yScale = Object.values(yAxisMap || {})[0]?.scale;
  if (!xScale || !yScale || !events.length) return null;

  const plotLeft  = offset?.left   ?? 0;
  const plotTop   = offset?.top    ?? 0;
  const plotRight = plotLeft + (offset?.width ?? 0);
  const plotBot   = plotTop + (offset?.height ?? 0);

  const carbBadges = [];
  const bgBadges   = [];

  events.forEach((e, i) => {
    const x = xScale(new Date(e.created_at).getTime());
    if (x < plotLeft - 20 || x > plotRight + 20) return;

    if (e.carbs_g > 0) {
      carbBadges.push({ x, label: `${e.carbs_g}g`, key: `c${i}` });
    }
    if (e.bg_manual > 0) {
      const y = yScale(e.bg_manual);
      if (y >= plotTop && y <= plotBot) {
        bgBadges.push({ x, y, label: String(e.bg_manual), key: `b${i}` });
      }
    }
  });

  return (
    <g>
      {/* Carb pills — fixed row just inside top edge */}
      {carbBadges.map(({ x, label, key }) => (
        <g key={key}>
          <rect x={x - 14} y={plotTop + 2} width={28} height={14} rx={3} fill="#f97316" />
          <text
            x={x}
            y={plotTop + 12}
            textAnchor="middle"
            fontSize={9}
            fill="white"
            fontWeight="700"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Manual BG badges — pinned at actual glucose level */}
      {bgBadges.map(({ x, y, label, key }) => (
        <g key={key}>
          {/* Anchor dot */}
          <circle cx={x} cy={y} r={3.5} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          {/* Label box — offset right; flip left if near right edge */}
          <rect
            x={x + 6}
            y={y - 9}
            width={28}
            height={15}
            rx={3}
            fill="#fef3c7"
            stroke="#f59e0b"
            strokeWidth={1}
          />
          <text
            x={x + 20}
            y={y + 2}
            textAnchor="middle"
            fontSize={9}
            fill="#92400e"
            fontWeight="700"
          >
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function GlucoseChart({ readings, events = [], targetLow = 70, targetHigh = 180 }) {
  if (!readings || readings.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No readings to display
      </div>
    );
  }

  const data = [...readings]
    .sort((a, b) => new Date(a.reading_time) - new Date(b.reading_time))
    .map(r => ({ ...r, ts: new Date(r.reading_time).getTime() }));

  const spanHours = data.length >= 2
    ? (data[data.length - 1].ts - data[0].ts) / 3_600_000
    : 0;
  const tickFormatter = spanHours > 20 ? formatDateShort : formatTimeOnly;

  const avgVal = data.reduce((s, r) => s + r.value, 0) / data.length;
  const getColor = (value) => {
    if (value < 55 || value > 300) return '#f43f5e';
    if (value < targetLow || value > targetHigh) return '#f59e0b';
    return '#10b981';
  };

  const hasMealEvents    = events.some(e => e.meal_type);
  const hasMedEvents     = events.some(e => e.med_slot);
  const hasCarbEvents    = events.some(e => e.carbs_g > 0);
  const hasInsulinEvents = events.some(e => e.dose_given > 0 || e.insulin_units > 0);
  const hasManualBG      = events.some(e => e.bg_manual > 0);

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 22, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[40, 400]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Target range */}
          <ReferenceLine y={targetHigh} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={targetLow}  stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={55}         stroke="#f43f5e" strokeDasharray="4 2" strokeWidth={1} />

          {/* Event time markers — vertical lines only, no text (badges handle labels) */}
          {events.map(e => {
            const x = new Date(e.created_at).getTime();
            const isMeal  = !!e.meal_type;
            const isMed   = !!e.med_slot;
            const isCarbs = e.carbs_g > 0;
            const color   = isMeal ? '#8b5cf6' : isMed ? '#14b8a6' : isCarbs ? '#f97316' : '#3b82f6';

            // For insulin-only events keep a small label since there's no badge
            const insulinOnly = !isCarbs && !isMeal && !isMed && (e.dose_given > 0 || e.insulin_units > 0);
            const insulinLabel = insulinOnly
              ? { value: `${e.dose_given || e.insulin_units}u`, position: 'insideTopRight', fontSize: 9, fill: color }
              : undefined;

            return (
              <ReferenceLine
                key={e.id}
                x={x}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={insulinLabel}
              />
            );
          })}

          {/* Positioned badges: carb pills + manual BG values */}
          <Customized component={(props) => <EventBadges {...props} events={events} />} />

          <Line
            type="monotone"
            dataKey="value"
            stroke={getColor(avgVal)}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#334155' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      {events.length > 0 && (hasMealEvents || hasMedEvents || hasCarbEvents || hasInsulinEvents || hasManualBG) && (
        <div className="flex gap-4 flex-wrap mt-2 px-1">
          {hasMealEvents && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#8b5cf6' }} />Meal
            </span>
          )}
          {hasMedEvents && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#14b8a6' }} />Med
            </span>
          )}
          {hasCarbEvents && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-3 h-1.5 rounded-sm" style={{ backgroundColor: '#f97316' }} />Carbs
            </span>
          )}
          {hasInsulinEvents && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#3b82f6' }} />Insulin
            </span>
          )}
          {hasManualBG && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />Manual BG
            </span>
          )}
        </div>
      )}
    </>
  );
}
