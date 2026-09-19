import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, BarChart3 } from "lucide-react";
import { C, inr } from "../theme";
import { SectionCard } from "../components/shared";

export default function ReportsScreen({ kpis, charts }) {
  const avgGift = kpis.giftsRecorded > 0 ? Math.round(kpis.totalGiftValue / kpis.giftsRecorded) : 0;
  const cards = [
    ["Total Collection", inr(kpis.totalGiftValue), C.gold, C.goldSoft],
    ["Average Gift", inr(avgGift), C.primary, C.primarySoft],
    ["Total Events", String(kpis.totalEvents), C.success, C.successSoft],
    ["Paid Subscribers", String(kpis.paidSubscribers), "#E48BA5", "#FDF1F4"],
  ];
  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {cards.map(([k, v, tint, soft]) => (
          <div key={k} className="rf-card hoverable" style={{ padding: 20 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><BarChart3 size={17} /></div>
            <div style={{ fontSize: 12.5, color: C.sub }}>{k}</div>
            <div style={{ fontSize: 21, fontWeight: 700, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
      <SectionCard
        title="Gift Value by Month"
        action={<div style={{ display: "flex", gap: 8 }}>
          <button className="rf-btn ghost" disabled title="Export wiring is a follow-up — data below is already live"><Download size={14} /> Excel</button>
          <button className="rf-btn ghost" disabled><Download size={14} /> CSV</button>
        </div>}>
        {charts.giftTrend.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: C.sub, fontSize: 13 }}>Not enough data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.giftTrend}>
              <CartesianGrid stroke="#F1F3F6" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }} formatter={(v) => inr(v)} />
              <Bar dataKey="value" name="Gift value" fill={C.gold} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}
