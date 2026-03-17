import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

// ── Metric Card ─────────────────────────────────────
function MetricCard({ label, value, suffix = "%", color, description }) {
  const colors = {
    blue:   "border-accent-blue text-accent-blue bg-blue-900/20",
    green:  "border-accent-green text-accent-green bg-green-900/20",
    yellow: "border-accent-yellow text-accent-yellow bg-yellow-900/20",
    red:    "border-red-500 text-red-400 bg-red-900/20",
    purple: "border-purple-500 text-purple-400 bg-purple-900/20",
  };
  return (
    <div className={`border-l-4 rounded-xl p-5 ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}{suffix}</div>
      <div className="text-white font-medium mt-1">{label}</div>
      <div className="text-gray-400 text-xs mt-1">{description}</div>
    </div>
  );
}

// ── Confusion Matrix ────────────────────────────────
function ConfusionMatrix({ matrix }) {
  if (!matrix) return null;
  const { true_positive, true_negative, false_positive, false_negative } = matrix;
  const total = true_positive + true_negative + false_positive + false_negative;

  const cells = [
    {
      label: "True Positive",
      value: true_positive,
      sub: "Correctly detected anomaly",
      color: "bg-green-900/40 border-green-700 text-green-400",
    },
    {
      label: "False Positive",
      value: false_positive,
      sub: "Normal flagged as anomaly",
      color: "bg-yellow-900/40 border-yellow-700 text-yellow-400",
    },
    {
      label: "False Negative",
      value: false_negative,
      sub: "Anomaly missed by model",
      color: "bg-red-900/40 border-red-700 text-red-400",
    },
    {
      label: "True Negative",
      value: true_negative,
      sub: "Correctly identified normal",
      color: "bg-blue-900/40 border-blue-700 text-blue-400",
    },
  ];

  return (
    <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-1">Confusion Matrix</h3>
      <p className="text-gray-400 text-xs mb-4">
        Based on {total} samples — how well the model classifies traffic
      </p>

      <div className="grid grid-cols-2 gap-3">
        {cells.map(cell => (
          <div
            key={cell.label}
            className={`border rounded-xl p-4 ${cell.color}`}
          >
            <div className="text-3xl font-bold">{cell.value}</div>
            <div className="font-medium text-sm mt-1">{cell.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{cell.sub}</div>
            <div className="text-xs opacity-50 mt-1">
              {total > 0 ? ((cell.value / total) * 100).toFixed(1) : 0}% of total
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>TP + TN = Correct predictions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>FP + FN = Wrong predictions</span>
        </div>
      </div>
    </div>
  );
}

// ── Score Bar ───────────────────────────────────────
function ScoreBar({ label, value, color }) {
  const colors = {
    blue:   "bg-orange-500",
    green:  "bg-green-500",
    yellow: "bg-yellow-500",
    red:    "bg-red-500",
    purple: "bg-purple-500",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <span className="text-white font-bold text-sm">{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden w-full">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${colors[color]}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── What Each Metric Means ──────────────────────────
function MetricExplainer() {
  const items = [
    {
      term: "Accuracy",
      color: "text-accent-blue",
      explain: "Out of ALL traffic logs, how many did the model classify correctly (both normal and anomalous)."
    },
    {
      term: "Precision",
      color: "text-accent-green",
      explain: "Out of all logs flagged as anomalies, how many were actually anomalies. High precision = fewer false alarms."
    },
    {
      term: "Recall",
      color: "text-accent-yellow",
      explain: "Out of all real anomalies, how many did the model catch. High recall = fewer missed attacks."
    },
    {
      term: "F1 Score",
      color: "text-purple-400",
      explain: "Balance between Precision and Recall. Best single number to judge overall model quality."
    },
    {
      term: "False Positive Rate",
      color: "text-red-400",
      explain: "How often normal traffic is wrongly flagged as suspicious. Lower is better — reduces alert fatigue."
    },
  ];

  return (
    <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4">What Do These Metrics Mean?</h3>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.term} className="flex gap-3">
            <span className={`font-semibold text-sm w-36 flex-shrink-0 ${item.color}`}>
              {item.term}
            </span>
            <span className="text-gray-400 text-sm">{item.explain}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ML Metrics Page ────────────────────────────
export default function MLMetrics() {
  const [metrics, setMetrics]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [retraining, setRetraining] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/logs/ml-metrics`, { withCredentials: true });
      setMetrics(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const retrainModel = async () => {
    setRetraining(true);
    try {
      await axios.post(`${API}/logs/retrain`, {}, { withCredentials: true });
      await fetchMetrics();
      alert("Model retrained successfully!");
    } catch (err) {
      alert("Retrain failed — check Flask terminal");
    } finally {
      setRetraining(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading ML metrics...
    </div>
  );

  if (error) return (
    <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl p-5 text-sm">
      ⚠️ {error} — Make sure model is trained and you have enough logs.
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">ML Model Performance</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Isolation Forest — trained on {metrics?.total_samples} samples
          </p>
        </div>
        <button
          onClick={retrainModel}
          disabled={retraining}
          className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40
                     rounded-lg px-4 py-2 text-sm hover:bg-accent-blue/30
                     transition-colors disabled:opacity-50"
        >
          {retraining ? "Retraining..." : "🔄 Retrain Model"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Accuracy"
          value={metrics?.accuracy}
          color="blue"
          description="Overall correct classifications"
        />
        <MetricCard
          label="Precision"
          value={metrics?.precision}
          color="green"
          description="Fewer false alarms"
        />
        <MetricCard
          label="Recall"
          value={metrics?.recall}
          color="yellow"
          description="Attacks caught"
        />
        <MetricCard
          label="F1 Score"
          value={metrics?.f1_score}
          color="purple"
          description="Overall model quality"
        />
      </div>

      {/* Score Bars + Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Score Bars */}
        <div className="bg-brand-card border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">Performance Breakdown</h3>
          <ScoreBar label="Accuracy"           value={metrics?.accuracy}           color="blue"   />
          <ScoreBar label="Precision"          value={metrics?.precision}          color="green"  />
          <ScoreBar label="Recall"             value={metrics?.recall}             color="yellow" />
          <ScoreBar label="F1 Score"           value={metrics?.f1_score}           color="purple" />
          <ScoreBar label="False Positive Rate" value={metrics?.false_positive_rate} color="red"  />

          {/* Sample breakdown */}
          <div className="pt-3 border-t border-gray-700 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-white font-bold">{metrics?.total_samples}</div>
              <div className="text-gray-400 text-xs">Total Samples</div>
            </div>
            <div>
              <div className="text-red-400 font-bold">{metrics?.anomaly_count}</div>
              <div className="text-gray-400 text-xs">Anomalies</div>
            </div>
            <div>
              <div className="text-green-400 font-bold">{metrics?.normal_count}</div>
              <div className="text-gray-400 text-xs">Normal</div>
            </div>
          </div>
        </div>

        {/* Confusion Matrix */}
        <ConfusionMatrix matrix={metrics?.confusion_matrix} />
      </div>

      {/* Explainer */}
      <MetricExplainer />

    </div>
  );
}