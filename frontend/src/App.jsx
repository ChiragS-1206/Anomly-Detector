import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./components/Dashboard";
import LogsTable from "./components/LogsTable";
import AlertsPanel from "./components/AlertsPanel";
import PolicyManager from "./components/PolicyManager";
import MLMetrics from "./components/MLMetrics";
import Compliance from "./components/Compliance";

function Layout({ username, onLogout, children }) {
  const navItems = [
    { to: "/",       label: "Dashboard", icon: "📊" },
    { to: "/logs",   label: "Logs",      icon: "📋" },
    { to: "/alerts", label: "Alerts",    icon: "🚨" },
    { to: "/policies",label: "Policy Manager", icon: "🛡️" },
    { to: "/ml-metrics", label: "ML Metrics", icon: "🤖" },
    { to: "/compliance", label: "Compliance", icon: "📈" },
  ];

  return (
    <div className="min-h-screen bg-brand flex">
      {/* Sidebar */}
      <aside className="w-56 bg-brand-card border-r border-gray-700 flex flex-col fixed h-screen">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center text-white text-xs font-bold">N</div>
            <div>
              <div className="text-white font-bold text-sm leading-none">NetSentinel</div>
              <div className="text-gray-500 text-xs mt-0.5">Anomaly Detector</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                 ${isActive
                   ? "bg-accent-blue/20 text-accent-blue font-medium"
                   : "text-gray-400 hover:text-white hover:bg-gray-700"}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-medium">{username}</div>
              <div className="text-gray-500 text-xs">Administrator</div>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-red-400 transition-colors text-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 p-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem("admin_user"));

  const handleLogin = (username) => {
    setUser(username);
    localStorage.setItem("admin_user", username);
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST", credentials: "include"
      });
    } catch (_) {}
    setUser(null);
    localStorage.removeItem("admin_user");
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/*" element={
          !user ? <Navigate to="/login" /> : (
            <Layout username={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/"       element={<Dashboard />} />
                <Route path="/logs"   element={<LogsTable />} />
                <Route path="/alerts" element={<AlertsPanel />} />
                <Route path="/policies" element={<PolicyManager />} />
                <Route path="/ml-metrics" element={<MLMetrics />} />
                <Route path="/compliance" element={<Compliance />} />
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}