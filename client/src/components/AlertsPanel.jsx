import { Link } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { api } from '../api';

const ALERT_CONFIG = {
  critical_low:  { icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', label: 'Critical Low' },
  low:           { icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Low' },
  high:          { icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'High' },
  critical_high: { icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', label: 'Critical High' },
  no_data:       { icon: WifiOff, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', label: 'No Data' },
};

export default function AlertsPanel({ alerts, onAcknowledge }) {
  if (!alerts) return null;

  async function ack(alertId) {
    try {
      await api.acknowledgeAlert(alertId);
      onAcknowledge(alertId);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <Bell size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700">Active Alerts</h2>
        {alerts.length > 0 && (
          <span className="ml-auto bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {Math.min(alerts.length, 99)}
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 max-h-[calc(100vh-12rem)] overflow-y-auto no-scrollbar">
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            <CheckCircle className="mx-auto mb-2 text-emerald-400" size={24} />
            <p className="text-sm">All clear</p>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = ALERT_CONFIG[alert.type] || ALERT_CONFIG.no_data;
            const Icon = cfg.icon;
            return (
              <div key={alert.id} className={`px-4 py-3 border-l-4 ${cfg.bg}`} style={{ borderLeftColor: cfg.color.replace('text-', '') }}>
                <div className="flex items-start gap-2">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/campers/${alert.camper_id}`}
                      className="font-medium text-slate-800 text-sm hover:underline truncate block"
                    >
                      {alert.camper_name}
                    </Link>
                    <p className={`text-xs font-semibold ${cfg.color}`}>
                      {cfg.label}{alert.value ? ` · ${alert.value} mg/dL` : ''}
                    </p>
                    {alert.cabin_group && (
                      <p className="text-xs text-slate-400">{alert.cabin_group}</p>
                    )}
                  </div>
                  <button
                    onClick={() => ack(alert.id)}
                    title="Acknowledge"
                    className="shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
