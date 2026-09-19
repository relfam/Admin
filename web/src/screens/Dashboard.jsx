import React from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, Sparkles, CalendarDays, Clock, Gift, IndianRupee, Crown, ShieldAlert,
  ArrowUpRight, ArrowDownRight, UserPlus, Megaphone, Send, Database, ChevronRight as ChevIcon,
} from "lucide-react";
import { C, inr } from "../theme";
import { SectionCard, Sparkline, Chip } from "../components/shared";

export default function Dashboard({ kpis, charts, activity, goFraud, goAds, goSupport, goNotifications }) {
  const KPIS = [
    { icon: Users, label: "Total Users", value: kpis.totalUsers.toLocaleString("en-IN"), growth: kpis.userGrowthPct, tint: C.primary, soft: C.primarySoft, spark: kpis.userSpark },
    { icon: Sparkles, label: "Active Users (30d)", value: kpis.activeUsers.toLocaleString("en-IN"), growth: kpis.activeGrowthPct, tint: C.success, soft: C.successSoft, spark: kpis.activeSpark },
    { icon: CalendarDays, label: "Total Events", value: kpis.totalEvents.toLocaleString("en-IN"), growth: kpis.eventGrowthPct, tint: C.gold, soft: C.goldSoft, spark: kpis.eventSpark },
    { icon: Clock, label: "Events Today", value: String(kpis.eventsToday), growth: 0, tint: "#8B5CF6", soft: "#F3EFFE", spark: [kpis.eventsToday, kpis.eventsToday] },
    { icon: Gift, label: "Gifts Recorded", value: kpis.giftsRecorded.toLocaleString("en-IN"), growth: 0, tint: "#E48BA5", soft: "#FDF1F4", spark: kpis.giftSpark },
    { icon: IndianRupee, label: "Total Gift Value", value: inr(kpis.totalGiftValue), growth: kpis.giftGrowthPct, tint: C.success, soft: C.successSoft, spark: kpis.giftValueSpark },
    { icon: Crown, label: "Paid Subscribers", value: String(kpis.paidSubscribers), growth: 0, tint: C.gold, soft: C.goldSoft, spark: [kpis.paidSubscribers, kpis.paidSubscribers] },
    { icon: ShieldAlert, label: "Open Fraud Cases", value: String(kpis.openFraudCases), growth: 0, tint: C.warning, soft: C.warningSoft, spark: [kpis.openFraudCases, kpis.openFraudCases] },
  ];

  const quickActions = [
    [UserPlus, "Add User", C.primary, C.primarySoft, undefined],
    [Megaphone, "Create Announcement", C.gold, C.goldSoft, goAds],
    [ShieldAlert, "Review Fraud Cases", C.error, C.errorSoft, goFraud],
    [Send, "Send Notification", "#E48BA5", "#FDF1F4", goNotifications],
    [Database, "Open Support Queue", C.success, C.successSoft, goSupport],
  ];

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {KPIS.map((k) => (
          <div key={k.label} className="rf-card hoverable" style={{ padding: 18, cursor: k.label === "Open Fraud Cases" ? "pointer" : "default" }} onClick={k.label === "Open Fraud Cases" ? goFraud : undefined}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: k.soft, color: k.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={19} />
              </div>
              <Sparkline data={k.spark} color={k.tint} />
            </div>
            <div style={{ marginTop: 14, fontSize: 12.5, color: C.sub, fontWeight: 500 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{k.value}</span>
              {k.growth !== 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 700, color: k.growth >= 0 ? C.success : C.error }}>
                  {k.growth >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(k.growth)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <SectionCard title="User Growth">
          {charts.growth.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.growth}>
                <CartesianGrid stroke="#F1F3F6" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Line type="monotone" dataKey="users" stroke={C.primary} strokeWidth={2.5} dot={false} name="Cumulative signups" />
                <Line type="monotone" dataKey="dau" stroke={C.gold} strokeWidth={2} dot={false} name="Active that month" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Event Types">
          {charts.eventTypes.length === 0 ? <Empty /> : <>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={charts.eventTypes} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {charts.eventTypes.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              {charts.eventTypes.map((e) => (
                <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.sub }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: e.color }} /> {e.name} · {e.value}%
                </div>
              ))}
            </div>
          </>}
        </SectionCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <SectionCard title="Event Creation">
          {charts.eventsByMonth.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.eventsByMonth}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Bar dataKey="events" fill={C.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Gift Value Trend (₹)">
          {charts.giftTrend.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={charts.giftTrend}>
                <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.35} /><stop offset="100%" stopColor={C.gold} stopOpacity={0.02} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => inr(v)} />
                <Area type="monotone" dataKey="value" stroke={C.gold} strokeWidth={2.5} fill="url(#gv)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Subscription Revenue (₹)">
          {charts.revenue.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={charts.revenue}>
                <defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.success} stopOpacity={0.3} /><stop offset="100%" stopColor={C.success} stopOpacity={0.02} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => inr(v)} />
                <Area type="monotone" dataKey="rev" stroke={C.success} strokeWidth={2.5} fill="url(#rv)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <SectionCard title="Recent Activity">
          {activity.length === 0 ? <Empty /> : (
            <div style={{ display: "grid", gap: 4 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 8px", borderRadius: 12, transition: "background .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: a.soft, color: a.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <a.icon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</div>
                  </div>
                  <Chip text={a.badge[0]} tone={[a.badge[1], a.badge[2]]} />
                  <span style={{ fontSize: 11.5, color: C.sub, width: 56, textAlign: "right" }}>{a.time}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Quick Actions">
          <div style={{ display: "grid", gap: 10 }}>
            {quickActions.map(([Icon, label, tint, soft, onClick]) => (
              <button key={label} className="rf-card hoverable" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: onClick ? "pointer" : "default", fontSize: 13.5, fontWeight: 600, border: `1px solid ${C.border}`, background: "#fff", textAlign: "left", width: "100%" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} /></span>
                {label}
                <ChevIcon size={15} style={{ marginLeft: "auto", color: C.sub }} />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

const Empty = () => <div style={{ padding: "30px 0", textAlign: "center", color: C.sub, fontSize: 12.5 }}>Not enough data yet.</div>;
