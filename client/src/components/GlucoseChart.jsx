import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-slate-500 text-xs">{formatTime(d.reading_time)}</p>
      <p className="text-slate-800 font-bold text-lg">{d.value} <span className="text-xs font-normal text-slate-400">mg/dL</span></p>
    </div>
  );
};

export default function GlucoseChart({ readings, targetLow = 70, targetHigh = 180 }) {
  if (!readings || readings.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No readings to display
      </div>
    );
  }

  const data = [...readings].sort((a, b) => new Date(a.reading_time) - new Date(b.reading_time));

  const getColor = (value) => {
    if (value < 55 || value > 300) return '#f43f5e';
    if (value < targetLow || value > targetHigh) return '#f59e0b';
    return '#10b981';
  };

  // Use a gradient dot color approach — simplest: one line color based on avg
  const avgVal = data.reduce((s, r) => s + r.value, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="reading_time"
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

        {/* Target range band */}
        <ReferenceLine y={targetHigh} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
        <ReferenceLine y={targetLow} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
        <ReferenceLine y={55} stroke="#f43f5e" strokeDasharray="4 2" strokeWidth={1} />

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
