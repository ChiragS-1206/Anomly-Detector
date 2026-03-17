import { useEffect, useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Title, Tooltip, Legend
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import axios from "axios";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend
);

const API = "http://localhost:5000/api";

// ── Stat Card ──────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  const colors = {
    blue:   "border-accent-blue text-accent-blue bg-blue-900/20",
    green:  "border-accent-green text-accent-green bg-green-900/20",
    red:    "border-red-500 text-red-500 bg-red-900/20",
    yellow: "border-accent-yellow text-accent-yellow bg-yellow-900/20",
  };
  return (
    <div className={`border-l-4 rounded-xl p-5 ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-white font-medium mt-1">{label}</div>
      {sub && <div className="text-gray-400 text-xs mt-1">{sub}</div>}
    </div>
  );
}

// ── Charts ─────────────────────────────────────────
function TrafficChart({ hourly }) {
  const data = {
    labels: (hourly || []).map(h => `${h.hour}:00`),
    datasets: [{
      label: "Logs/hour",
      data: (hourly || []).map(h => h.count),
      backgroundColor: "rgba(59,130,246,0.5)",
      borderColor: "#3b82f6",
      borderWidth: 1,
      borderRadius: 4,
    }]
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#9ca3af" }, grid: { color: "#374151" } },
      y: { ticks: { color: "#9ca3af" }, grid: { color: "#374151" } }
    }
  };
  return <Bar data={data} options={options} />;
}

function ProtocolChart({ protocols }) {
  const data = {
    labels: (protocols || []).map(p => p.protocol),
    datasets: [{
      data: (protocols || []).map(p => p.count),
      backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"],
      borderWidth: 0,
    }]
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#d1d5db" } }
    }
  };
  return <Doughnut data={data} options={options} />;
}

// ── Dashboard ──────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/logs/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading dashboard...
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Overview</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Logs"      value={stats?.total_logs?.toLocaleString()}      color="blue"   sub="All time" />
        <StatCard label="Anomalies"        value={stats?.total_anomalies?.toLocaleString()}  color="yellow" sub={`${stats?.anomaly_rate}% rate`} />
        <StatCard label="Critical Alerts"  value={stats?.critical_count?.toLocaleString()}   color="red"    sub="High severity" />
        <StatCard label="Normal Traffic"   value={stats?.normal_count?.toLocaleString()}     color="green"  sub="Clean logs" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-brand-card border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Hourly Traffic (Last 24h)</h3>
          <TrafficChart hourly={stats?.hourly_traffic} />
        </div>
        <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Protocol Breakdown</h3>
          <ProtocolChart protocols={stats?.protocol_breakdown} />
        </div>
      </div>

      {/* Top Attackers */}
      <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Top Anomalous IPs</h3>
        <div className="space-y-2">
          {(stats?.top_attacker_ips || []).map((ip, i) => (
            <div key={ip.source_ip} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-4">{i + 1}</span>
                <span className="text-red-400 font-mono text-sm">{ip.source_ip}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 bg-red-900 rounded-full w-24">
                  <div
                    className="h-2 bg-red-500 rounded-full"
                    style={{ width: `${Math.min((ip.count / 50) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-gray-300 text-sm w-12 text-right">{ip.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}