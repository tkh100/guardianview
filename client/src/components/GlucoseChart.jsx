import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs">{formatTime(d.ts)}</p>
      <p className="text-slate-800 font-bold text-lg">{d.value} <span className="text-xs font-normal text-slate-400">mg/dL</span></p>
    </div>
  );
};

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

  const avgVal = data.reduce((s, r) => s + r.value, 0) / data.length;
  const getColor = (value) => {
    if (value < 55 || value > 300) return '#f43f5e';
    if (value < targetLow || value > targetHigh) return '#f59e0b';
    return '#10b981';
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatTime}
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
        <ReferenceLine y={targetLow} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
        <ReferenceLine y={55} stroke="#f43f5e" strokeDasharray="4 2" strokeWidth={1} />

        {/* Event markers */}
        {events.map(e => {
          const x = new Date(e.created_at).getTime();
          const isCarbs = e.carbs_g > 0;
          const color = isCarbs ? '#f97316' : '#3b82f6';
          const parts = [];
          if (e.carbs_g) parts.push(`${e.carbs_g}g`);
          if (e.insulin_units) parts.push(`${e.insulin_units}u`);
          return (
            <ReferenceLine
              key={e.id}
              x={x}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
              label={{ value: parts.join(' / '), position: 'insideTopRight', fontSize: 9, fill: color }}
            />
          );
        })}

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
  );
}
