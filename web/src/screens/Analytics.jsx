import React, { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Globe, Sparkles } from "lucide-react";
import { C } from "../theme";
import { SectionCard } from "../components/shared";

export default function AnalyticsScreen({ charts, users }) {
  const topLocations = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      if (!u.city || u.city === "—") return;
      const key = u.city.trim().replace(/\b\w/g, (c) => c.toUpperCase());
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [users]);

  const packageMix = useMemo(() => {
    const total = users.length || 1;
    const counts = { Regular: 0, Pro: 0, Advanced: 0 };
    users.forEach((u) => { counts[u.pkg] = (counts[u.pkg] || 0) + 1; });
    return Object.entries(counts).map(([f, n]) => ({ f, v: Math.round((n / total) * 100) }));
  }, [users]);

  return (
    <div className="rf-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <SectionCard title="Active Users by Month">
        {charts.growth.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.growth}>
              <defs><linearGradient id="dau" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.primary} stopOpacity={0.3} /><stop offset="100%" stopColor={C.primary} stopOpacity={0.02} /></linearGradient></defs>
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Area type="monotone" dataKey="dau" stroke={C.primary} strokeWidth={2.5} fill="url(#dau)" name="Active users" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Top User Locations">
        {topLocations.length === 0 ? <Empty note="No addresses on file yet." /> : topLocations.map(([k, v], i) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
            <span style={{ width: 22, color: C.sub, fontWeight: 600 }}>{i + 1}</span>
            <Globe size={15} style={{ color: C.primary }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{k}</span>
            <span style={{ color: C.sub }}>{v} user{v === 1 ? "" : "s"}</span>
          </div>
        ))}
        <div style={{ marginTop: 14, padding: 12, background: C.primarySoft, borderRadius: 12, fontSize: 12, color: C.primary, display: "flex", gap: 8 }}>
          <Sparkles size={14} style={{ flexShrink: 0 }} /> Based on free-text profile addresses — not a normalized city field yet.
        </div>
      </SectionCard>

      <SectionCard title="Package Mix">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart layout="vertical" data={packageMix}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="f" width={90} tick={{ fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => v + "%"} />
            <Bar dataKey="v" fill={C.primary} radius={[0, 6, 6, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Event Type Mix">
        {charts.eventTypes.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={charts.eventTypes.map((e) => ({ f: e.name, v: e.value }))}>
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis type="category" dataKey="f" width={110} tick={{ fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => v + "%"} />
              <Bar dataKey="v" fill={C.gold} radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}

const Empty = ({ note }) => <div style={{ padding: "30px 0", textAlign: "center", color: C.sub, fontSize: 12.5 }}>{note || "Not enough data yet."}</div>;
