import React, { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import Login from "./Login";
import RelfamAdmin from "./AdminDashboard";

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me().then((d) => setAdmin(d.admin)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontFamily: "sans-serif", fontSize: 13.5 }}>Loading…</div>;
  }
  if (!admin) return <Login onLogin={setAdmin} />;

  const logout = () => {
    api.logout().catch(() => {});
    setToken(null);
    setAdmin(null);
  };

  return <RelfamAdmin admin={admin} onLogout={logout} />;
}
