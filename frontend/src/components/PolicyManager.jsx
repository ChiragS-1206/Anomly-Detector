import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

const SEVERITY_STYLE = {
  CRITICAL: "bg-red-900/40 text-red-400 border-red-700",
  HIGH:     "bg-orange-900/40 text-orange-400 border-orange-700",
  MEDIUM:   "bg-yellow-900/40 text-yellow-400 border-yellow-700",
  LOW:      "bg-gray-800 text-gray-400 border-gray-600",
};

const RULE_TYPES = [
  { value: "BLOCK_PORT",  label: "Block Port" },
  { value: "MAX_BYTES",   label: "Max Bytes Allowed" },
  { value: "MAX_PACKETS", label: "Max Packets Allowed" },
  { value: "AFTER_HOURS", label: "After Hours Access" },
  { value: "PORT_SCAN",   label: "Port Scan Detection" },
];

// ── Add Policy Form ─────────────────────────────────
function AddPolicyForm({ onAdded }) {
  const [form, setForm] = useState({
    name: "", description: "",
    rule_type: "BLOCK_PORT", rule_value: "", severity: "HIGH"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.rule_value) {
      setError("Name and Rule Value are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/policies/`, form, { withCredentials: true });
      setForm({ name: "", description: "", rule_type: "BLOCK_PORT", rule_value: "", severity: "HIGH" });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create policy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-card border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4">➕ Add New Policy</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Policy Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Block External FTP"
            className="w-full bg-brand-light border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Rule Type */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Rule Type</label>
          <select
            value={form.rule_type}
            onChange={e => setForm({ ...form, rule_type: e.target.value })}
            className="w-full bg-brand-light border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          >
            {RULE_TYPES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Rule Value */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Rule Value
            <span className="text-gray-500 ml-1">
              {form.rule_type === "BLOCK_PORT"  && "(port number e.g. 21)"}
              {form.rule_type === "MAX_BYTES"   && "(bytes e.g. 100000)"}
              {form.rule_type === "MAX_PACKETS" && "(packets e.g. 500)"}
              {form.rule_type === "AFTER_HOURS" && "(hour 0-23 e.g. 23)"}
              {form.rule_type === "PORT_SCAN"   && "(port count e.g. 10)"}
            </span>
          </label>
          <input
            type="text"
            value={form.rule_value}
            onChange={e => setForm({ ...form, rule_value: e.target.value })}
            placeholder="Enter value..."
            className="w-full bg-brand-light border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Severity</label>
          <select
            value={form.severity}
            onChange={e => setForm({ ...form, severity: e.target.value })}
            className="w-full bg-brand-light border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          >
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what this policy does..."
            className="w-full bg-brand-light border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 bg-accent-blue hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Policy"}
      </button>
    </div>
  );
}

// ── Policy Card ─────────────────────────────────────
function PolicyCard({ policy, onToggle, onDelete }) {
  return (
    <div className={`bg-brand-card border rounded-xl p-4 border-l-4 ${
      policy.severity === "CRITICAL" ? "border-l-red-500 border-gray-700" :
      policy.severity === "HIGH"     ? "border-l-orange-500 border-gray-700" :
      policy.severity === "MEDIUM"   ? "border-l-yellow-500 border-gray-700" :
                                       "border-l-gray-500 border-gray-700"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">

          {/* Name + Severity */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{policy.name}</span>
            <span className={`border rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLE[policy.severity]}`}>
              {policy.severity}
            </span>
            {!policy.is_active && (
              <span className="bg-gray-800 text-gray-500 border border-gray-600 rounded-full px-2 py-0.5 text-xs">
                DISABLED
              </span>
            )}
          </div>

          {/* Description */}
          {policy.description && (
            <p className="text-gray-400 text-xs mt-1">{policy.description}</p>
          )}

          {/* Rule details */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="bg-brand-light border border-gray-600 rounded px-2 py-0.5 text-gray-300">
              {RULE_TYPES.find(r => r.value === policy.rule_type)?.label || policy.rule_type}
            </span>
            <span className="text-accent-blue font-mono">value: {policy.rule_value}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onToggle(policy.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              policy.is_active
                ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700 hover:bg-yellow-900/50"
                : "bg-green-900/30 text-green-400 border border-green-700 hover:bg-green-900/50"
            }`}
          >
            {policy.is_active ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onDelete(policy.id)}
            className="bg-red-900/30 text-red-400 border border-red-700 hover:bg-red-900/50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Violations Table ────────────────────────────────
function ViolationsTable() {
  const [violations, setViolations] = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/policies/violations`, { withCredentials: true });
      setViolations(res.data.violations);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load violations:", err);
    } finally {
      setLoading(false);
    }
  };

  const resolveViolation = async (id) => {
    try {
      await axios.patch(`${API}/policies/violations/${id}/resolve`, {}, { withCredentials: true });
      setViolations(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      console.error("Failed to resolve:", err);
    }
  };

  useEffect(() => {
    fetchViolations();
    const interval = setInterval(fetchViolations, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-brand-card border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">Policy Violations</h3>
        <span className="text-red-400 text-sm font-medium">{total} total</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading violations...</div>
      ) : violations.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-gray-400 text-sm">No policy violations detected</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-brand-light">
                {["Time", "Policy", "Severity", "Source IP", "Description", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {violations.map(v => (
                <tr key={v.id} className="border-b border-gray-800 hover:bg-brand-light/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(v.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white text-xs font-medium">{v.policy_name}</td>
                  <td className="px-4 py-3">
                    <span className={`border rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLE[v.severity]}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-red-400 text-xs">{v.source_ip}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{v.description}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => resolveViolation(v.id)}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-1 text-xs transition-colors"
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Policy Manager Page ────────────────────────
export default function PolicyManager() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState("policies"); // policies | violations

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/policies/`, { withCredentials: true });
      setPolicies(res.data.policies);
    } catch (err) {
      console.error("Failed to load policies:", err);
    } finally {
      setLoading(false);
    }
  };

  const togglePolicy = async (id) => {
    try {
      await axios.patch(`${API}/policies/${id}/toggle`, {}, { withCredentials: true });
      fetchPolicies();
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  };

  const deletePolicy = async (id) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    try {
      await axios.delete(`${API}/policies/${id}`, { withCredentials: true });
      fetchPolicies();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  useEffect(() => { fetchPolicies(); }, []);

  const active   = policies.filter(p => p.is_active).length;
  const disabled = policies.filter(p => !p.is_active).length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Policy Manager</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-400">{active} active</span>
          <span className="text-gray-500">{disabled} disabled</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {["policies", "violations"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-accent-blue text-white"
                : "bg-brand-card border border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Policies Tab */}
      {tab === "policies" && (
        <div className="space-y-4">
          <AddPolicyForm onAdded={fetchPolicies} />
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading policies...</div>
          ) : (
            <div className="space-y-3">
              {policies.map(policy => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onToggle={togglePolicy}
                  onDelete={deletePolicy}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Violations Tab */}
      {tab === "violations" && <ViolationsTable />}
    </div>
  );
}