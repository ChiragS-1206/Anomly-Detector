import { useEffect, useState } from "react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend
} from "chart.js";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend
);

const API = "http://localhost:5000/api";

// ── Score Circle ────────────────────────────────────
function ScoreCircle({ score, status }) {
  const color =
    status === "GOOD"     ? "#10b981" :
    status === "WARNING"  ? "#f59e0b" : "#ef4444";

  const statusBg =
    status === "GOOD"     ? "bg-green-900/30 text-green-400 border-green-700" :
    status === "WARNING"  ? "bg-yellow-900/30 text-yellow-400 border-yellow-700" :
                            "bg-red-900/30 text-red-400 border-red-700";

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-40 h-40">
        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54"
            fill="none" stroke="#374151" strokeWidth="10" />
          <circle cx="60" cy="60" r="54"
            fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{score}</span>
          <span className="text-gray-400 text-xs">out of 100</span>
        </div>
      </div>
      <span className={`border rounded-full px-4 py-1 text-sm font-semibold ${statusBg}`}>
        {status}
      </span>
    </div>
  );
}

// ── Daily Violations Chart ──────────────────────────
function DailyChart({ daily }) {
  // Group by date
  const dateMap = {};
  (daily || []).forEach(d => {
    if (!dateMap[d.date]) dateMap[d.date] = 0;
    dateMap[d.date] += d.violations;
  });

  const labels = Object.keys(dateMap).map(d =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
  const values = Object.values(dateMap);

  const data = {
    labels,
    datasets: [{
      label: "Violations",
      data: values,
      backgroundColor: "rgba(239,68,68,0.4)",
      borderColor: "#ef4444",
      borderWidth: 2,
      borderRadius: 4,
      tension: 0.4,
      fill: true,
    }]
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#9ca3af" }, grid: { color: "#374151" } },
      y: {
        ticks: { color: "#9ca3af", stepSize: 1 },
        grid: { color: "#374151" },
        beginAtZero: true
      }
    }
  };

  return <Bar data={data} options={options} />;
}

// ── Per Policy Table ────────────────────────────────
function PolicyBreakdown({ perPolicy }) {
  const SEVERITY_STYLE = {
    CRITICAL: "text-red-400",
    HIGH:     "text-orange-400",
    MEDIUM:   "text-yellow-400",
    LOW:      "text-gray-400",
  };

  return (
    <div className="bg-brand-card border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">Policy Compliance Breakdown</h3>
        <p className="text-gray-400 text-xs mt-0.5">Violations per policy — last 7 days</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-brand-light">
              {["Policy", "Severity", "Violations", "Status", "Active"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(perPolicy || []).map(p => (
              <tr key={p.id} className="border-b border-gray-800 hover:bg-brand-light/50">
                <td className="px-4 py-3 text-white text-xs font-medium">{p.name}</td>
                <td className={`px-4 py-3 text-xs font-semibold ${SEVERITY_STYLE[p.severity]}`}>
                  {p.severity}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className={`font-bold ${p.violation_count > 0 ? "text-red-400" : "text-green-400"}`}>
                    {p.violation_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.violation_count === 0 ? (
                    <span className="bg-green-900/30 text-green-400 border border-green-700 rounded-full px-2 py-0.5">
                      Compliant ✅
                    </span>
                  ) : (
                    <span className="bg-red-900/30 text-red-400 border border-red-700 rounded-full px-2 py-0.5">
                      Violated ❌
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className={p.is_active
                    ? "text-green-400"
                    : "text-gray-500"
                  }>
                    {p.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Compliance Page ────────────────────────────
export default function Compliance() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCompliance = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/policies/compliance-score`,
        { withCredentials: true }
      );
      setData(res.data);
    } catch (err) {
      console.error("Failed to load compliance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
    const interval = setInterval(fetchCompliance, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading compliance data...
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Compliance Dashboard</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Network policy compliance — last 7 days
          </p>
        </div>
        <button
          onClick={fetchCompliance}
          className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40
                     rounded-lg px-4 py-2 text-sm hover:bg-accent-blue/30 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Top Row — Score + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Score Circle */}
        <div className="bg-brand-card border border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center">
          <h3 className="text-white font-semibold mb-4">Overall Compliance Score</h3>
          <ScoreCircle score={data?.score} status={data?.status} />
          <p className="text-gray-400 text-xs mt-4 text-center">
            Score decreases with each policy violation.<br />
            Critical violations deduct more points.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            {
              label: "Total Logs",
              value: data?.total_logs?.toLocaleString(),
              sub: "Last 7 days",
              color: "border-accent-blue text-accent-blue bg-blue-900/20"
            },
            {
              label: "Total Violations",
              value: data?.total_violations?.toLocaleString(),
              sub: "Policy breaches",
              color: "border-red-500 text-red-400 bg-red-900/20"
            },
            {
              label: "Resolved",
              value: data?.resolved?.toLocaleString(),
              sub: "Violations fixed",
              color: "border-accent-green text-accent-green bg-green-900/20"
            },
            {
              label: "Unresolved",
              value: data?.unresolved?.toLocaleString(),
              sub: "Needs attention",
              color: "border-accent-yellow text-accent-yellow bg-yellow-900/20"
            },
          ].map(card => (
            <div key={card.label} className={`border-l-4 rounded-xl p-4 ${card.color}`}>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-white font-medium text-sm mt-1">{card.label}</div>
              <div className="text-gray-400 text-xs mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Violations Chart */}
      <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">
          Daily Violations — Last 7 Days
        </h3>
        <DailyChart daily={data?.daily_violations} />
      </div>

      {/* Per Policy Breakdown */}
      <PolicyBreakdown perPolicy={data?.per_policy} />

    </div>
  );
}