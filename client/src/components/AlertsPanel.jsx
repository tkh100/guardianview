import { Link } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { api } from '../api';

const ALERT_CONFIG = {
  critical_low:  { icon: TrendingDown, color: 'text-rose-600', iconBg: 'bg-rose-100', bg: 'bg-rose-50/60 hover:bg-rose-50', border: 'border-l-rose-500', label: 'Critical Low' },
  low:           { icon: TrendingDown, color: 'text-amber-600', iconBg: 'bg-amber-100', bg: 'bg-amber-50/60 hover:bg-amber-50', border: 'border-l-amber-400', label: 'Low' },
  high:          { icon: TrendingUp, color: 'text-amber-600', iconBg: 'bg-amber-100', bg: 'bg-amber-50/60 hover:bg-amber-50', border: 'border-l-amber-400', label: 'High' },
  critical_high: { icon: TrendingUp, color: 'text-rose-600', iconBg: 'bg-rose-100', bg: 'bg-rose-50/60 hover:bg-rose-50', border: 'border-l-rose-500', label: 'Critical High' },
  no_data:       { icon: WifiOff, color: 'text-slate-500', iconBg: 'bg-slate-100', bg: 'bg-slate-50/60 hover:bg-slate-50', border: 'border-l-slate-300', label: 'No Data' },
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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50/80 to-transparent">
        <Bell size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700 text-sm tracking-tight">Active Alerts</h2>
        {alerts.length > 0 && (
          <span className="ml-auto bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm shadow-rose-500/30">
            {Math.min(alerts.length, 99)}
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 max-h-[calc(100vh-12rem)] overflow-y-auto no-scrollbar">
        {alerts.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-400">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle className="text-emerald-400" size={20} />
            </div>
            <p className="text-sm font-medium text-slate-500">All clear</p>
            <p className="text-xs text-slate-400 mt-0.5">No active alerts right now</p>
          </div>
        ) : (
          alerts.map(alert => {
            const cfg = ALERT_CONFIG[alert.type] || ALERT_CONFIG.no_data;
            const Icon = cfg.icon;
            return (
              <div key={alert.id} className={`px-4 py-3 border-l-[3px] transition-colors animate-fade-in ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${cfg.iconBg}`}>
                    <Icon size={12} className={cfg.color} />
                  </span>
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
                    className="shrink-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full p-1 transition-colors"
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
