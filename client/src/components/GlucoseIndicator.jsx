/**
 * Color-coded glucose value display with trend arrow
 */
const TREND_ARROWS = {
  DoubleUp: '↑↑', SingleUp: '↑', FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '↓↓',
};

export function getGlucoseStatus(value, targetLow = 70, targetHigh = 180) {
  if (value === null || value === undefined) return 'nodata';
  if (value < 55) return 'critical_low';
  if (value < targetLow) return 'low';
  if (value > 300) return 'critical_high';
  if (value > targetHigh) return 'high';
  return 'normal';
}

export const STATUS_STYLES = {
  nodata:       { bg: 'bg-slate-200', text: 'text-slate-400', ring: 'ring-slate-300', label: 'No Data', dot: 'bg-slate-400' },
  normal:       { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300', label: 'In Range', dot: 'bg-emerald-500' },
  low:          { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300', label: 'Low', dot: 'bg-amber-500' },
  high:         { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300', label: 'High', dot: 'bg-amber-500' },
  critical_low: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-400', label: 'Critical Low', dot: 'bg-rose-600' },
  critical_high:{ bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-400', label: 'Critical High', dot: 'bg-rose-600' },
};

export default function GlucoseIndicator({ value, trend, targetLow, targetHigh, size = 'md' }) {
  const status = getGlucoseStatus(value, targetLow, targetHigh);
  const styles = STATUS_STYLES[status];
  const arrow = TREND_ARROWS[trend] || '';

  const sizes = {
    sm: 'text-lg font-bold',
    md: 'text-3xl font-bold',
    lg: 'text-5xl font-black',
  };

  return (
    <div>
      <div className={`flex items-baseline gap-1 ${styles.text}`}>
        <span className={sizes[size]}>
          {value ?? '--'}
        </span>
        {value && <span className="text-lg">{arrow}</span>}
      </div>
      {size !== 'sm' && <div className="text-xs text-slate-500 mt-0.5">mg/dL</div>}
    </div>
  );
}
