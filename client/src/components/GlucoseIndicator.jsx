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
  nodata:       { bg: 'bg-slate-100', text: 'text-slate-400', ring: 'ring-slate-200', border: 'border-slate-300', label: 'No Data', dot: 'bg-slate-400', solid: 'bg-slate-400' },
  normal:       { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60', text: 'text-emerald-700', ring: 'ring-emerald-200', border: 'border-emerald-400', label: 'In Range', dot: 'bg-emerald-500', solid: 'bg-emerald-500' },
  low:          { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/60', text: 'text-amber-700', ring: 'ring-amber-200', border: 'border-amber-400', label: 'Low', dot: 'bg-amber-500', solid: 'bg-amber-500' },
  high:         { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/60', text: 'text-amber-700', ring: 'ring-amber-200', border: 'border-amber-400', label: 'High', dot: 'bg-amber-500', solid: 'bg-amber-500' },
  critical_low: { bg: 'bg-gradient-to-br from-rose-50 to-rose-100/70', text: 'text-rose-700', ring: 'ring-rose-300', border: 'border-rose-500', label: 'Critical Low', dot: 'bg-rose-600', solid: 'bg-rose-600' },
  critical_high:{ bg: 'bg-gradient-to-br from-rose-50 to-rose-100/70', text: 'text-rose-700', ring: 'ring-rose-300', border: 'border-rose-500', label: 'Critical High', dot: 'bg-rose-600', solid: 'bg-rose-600' },
};

export default function GlucoseIndicator({ value, trend, targetLow, targetHigh, size = 'md' }) {
  const status = getGlucoseStatus(value, targetLow, targetHigh);
  const styles = STATUS_STYLES[status];
  const arrow = TREND_ARROWS[trend] || '';

  const sizes = {
    sm: 'text-lg font-bold',
    md: 'text-3xl font-bold tracking-tight',
    lg: 'text-6xl font-black tracking-tight',
  };
  const arrowSizes = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl' };

  return (
    <div>
      <div className={`flex items-baseline gap-1.5 ${styles.text}`}>
        <span className={sizes[size]}>
          {value ?? '--'}
        </span>
        {value && <span className={`${arrowSizes[size]} font-bold`}>{arrow}</span>}
      </div>
      {size !== 'sm' && <div className="text-xs font-medium text-slate-400 mt-0.5 tracking-wide">mg/dL</div>}
    </div>
  );
}
