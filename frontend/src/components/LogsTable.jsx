import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

const FLAG_STYLE = {
  NORMAL:     "bg-green-900/40 text-green-400 border border-green-700",
  SUSPICIOUS: "bg-yellow-900/40 text-yellow-400 border border-yellow-700",
  CRITICAL:   "bg-red-900/40 text-red-400 border border-red-700",
};

export default function LogsTable() {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ flag: "", protocol: "" });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50, ...filters };
      Object.keys(params).forEach(k => params[k] === "" && delete params[k]);
      const res = await axios.get(`${API}/logs/`, { params, withCredentials: true });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Network Logs</h2>
        <span className="text-gray-400 text-sm">{total.toLocaleString()} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filters.flag}
          onChange={e => { setFilters({ ...filters, flag: e.target.value }); setPage(1); }}
          className="bg-brand-light border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
        >
          <option value="">All Flags</option>
          <option value="NORMAL">Normal</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <select
          value={filters.protocol}
          onChange={e => { setFilters({ ...filters, protocol: e.target.value }); setPage(1); }}
          className="bg-brand-light border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue"
        >
          <option value="">All Protocols</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
        </select>

        <button
          onClick={fetchLogs}
          className="bg-accent-blue/20 text-accent-blue border border-accent-blue/40 rounded-lg px-4 py-2 text-sm hover:bg-accent-blue/30 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-brand-card border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-brand-light">
                {["Time", "Source IP", "Dest IP", "Port", "Protocol", "Bytes", "Packets", "Score", "Flag"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">No logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-brand-light/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-200 text-xs">{log.source_ip}</td>
                  <td className="px-4 py-3 font-mono text-gray-200 text-xs">{log.dest_ip}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{log.dest_port}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-900/30 text-blue-400 border border-blue-800 rounded px-2 py-0.5 text-xs">
                      {log.protocol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{log.bytes_sent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{log.packets}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`font-mono ${log.anomaly_score > 0.5 ? "text-red-400" : "text-gray-400"}`}>
                      {log.anomaly_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_STYLE[log.flag] || FLAG_STYLE.NORMAL}`}>
                      {log.flag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 text-sm px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-gray-400 text-sm">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < 50}
            className="text-gray-400 hover:text-white disabled:opacity-30 text-sm px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}