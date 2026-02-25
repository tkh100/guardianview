import { Link } from 'react-router-dom';
import { WifiOff, Clock } from 'lucide-react';
import GlucoseIndicator, { getGlucoseStatus, STATUS_STYLES } from './GlucoseIndicator';

function timeAgo(isoString) {
  if (!isoString) return null;
  const mins = Math.round((Date.now() - new Date(isoString)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function CamperCard({ camper }) {
  const status = getGlucoseStatus(camper.latest_value, camper.target_low, camper.target_high);
  const styles = STATUS_STYLES[status];
  const stale = camper.latest_reading_time
    ? Date.now() - new Date(camper.latest_reading_time) > 15 * 60_000
    : true;

  return (
    <Link to={`/campers/${camper.id}`}>
      <div className={`
        relative rounded-xl p-4 ring-2 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer
        ${styles.bg} ${styles.ring}
        ${(status === 'critical_low' || status === 'critical_high') ? 'animate-pulse' : ''}
      `}>
        {/* Status dot */}
        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${styles.dot}`} />

        <p className="font-semibold text-slate-800 text-sm truncate pr-4">{camper.name}</p>
        {camper.cabin_group && (
          <p className="text-slate-500 text-xs mb-2">{camper.cabin_group}</p>
        )}

        {!camper.cgm_connected ? (
          <div className="flex items-center gap-1 text-slate-400 text-sm mt-2">
            <WifiOff size={14} /> <span>Not connected</span>
          </div>
        ) : stale ? (
          <div className="flex items-center gap-1 text-slate-400 text-sm mt-2">
            <WifiOff size={14} /> <span>No recent data</span>
          </div>
        ) : (
          <div className="mt-1">
            <GlucoseIndicator
              value={camper.latest_value}
              trend={camper.latest_trend}
              targetLow={camper.target_low}
              targetHigh={camper.target_high}
              size="md"
            />
          </div>
        )}

        {camper.latest_reading_time && (() => {
          const mins = Math.round((Date.now() - new Date(camper.latest_reading_time)) / 60_000);
          const timeColor = mins > 15 ? 'text-rose-400' : mins > 10 ? 'text-amber-400' : 'text-slate-400';
          return (
            <div className={`flex items-center gap-1 text-xs mt-2 ${timeColor}`}>
              <Clock size={11} />
              <span>{timeAgo(camper.latest_reading_time)}</span>
            </div>
          );
        })()}

        {camper.sync_error && (
          <p className="text-rose-500 text-xs mt-1 truncate" title={camper.sync_error}>
            Sync error
          </p>
        )}
      </div>
    </Link>
  );
}
