import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

const SEVERITY_STYLE = {
  CRITICAL: "bg-red-900/40 text-red-400 border-red-700",
  HIGH:     "bg-orange-900/40 text-orange-400 border-orange-700",
  MEDIUM:   "bg-yellow-900/40 text-yellow-400 border-yellow-700",
  LOW:      "bg-gray-800 text-gray-400 border-gray-600",
};

const ALERT_ICONS = {
  PORT_SCAN:   "🔍",
  DOS_ATTACK:  "⚡",
  DATA_EXFIL:  "📤",
  BRUTE_FORCE: "🔑",
  UNKNOWN:     "⚠️",
};

export default function AlertsPanel() {
  const [alerts, setAlerts]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState(""); // severity filter

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = { resolved: "false", limit: 50 };
      if (filter) params.severity = filter;
      const [alertRes, summaryRes] = await Promise.all([
        axios.get(`${API}/alerts/`, { params, withCredentials: true }),
        axios.get(`${API}/alerts/summary`, { withCredentials: true })
      ]);
      setAlerts(alertRes.data.alerts);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id) => {
    try {
      await axios.patch(`${API}/alerts/${id}/resolve`, {}, { withCredentials: true });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error("Failed to resolve:", err);
    }
  };

  useEffect(() => { fetchAlerts(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Security Alerts</h2>
        <span className="text-red-400 font-semibold text-sm">
          {summary?.unresolved || 0} unresolved
        </span>
      </div>

      {/* Summary pills */}
      {summary && (
        <div className="flex gap-2 flex-wrap">
          {(summary.by_severity || []).map(s => (
            <button
              key={s.severity}
              onClick={() => setFilter(filter === s.severity ? "" : s.severity)}
              className={`border rounded-full px-3 py-1 text-xs font-medium transition-colors
                ${filter === s.severity ? "ring-2 ring-white" : ""}
                ${SEVERITY_STYLE[s.severity] || SEVERITY_STYLE.LOW}`}
            >
              {s.severity}: {s.count}
            </button>
          ))}
        </div>
      )}

      {/* Alert cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-brand-card border border-gray-700 rounded-xl">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-gray-400">No active alerts</div>
          </div>
        ) : alerts.map(alert => (
          <div
            key={alert.id}
            className={`bg-brand-card border rounded-xl p-4 border-l-4 ${
              alert.severity === "CRITICAL" ? "border-l-red-500 border-gray-700" :
              alert.severity === "HIGH"     ? "border-l-orange-500 border-gray-700" :
                                              "border-l-yellow-500 border-gray-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-xl flex-shrink-0">{ALERT_ICONS[alert.alert_type] || "⚠️"}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{alert.alert_type.replace(/_/g, " ")}</span>
                    <span className={`border rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.LOW}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1 truncate">{alert.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="font-mono text-red-400">{alert.source_ip}</span>
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => resolveAlert(alert.id)}
                className="flex-shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
                           rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Resolve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}