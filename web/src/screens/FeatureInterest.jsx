import React, { useState } from "react";
import { Wallet, Receipt, Store, RefreshCw } from "lucide-react";
import { C } from "../theme";
import { Avatar, Sparkline } from "../components/shared";

// One card per "Coming soon" tile in the app. "Asked to be notified" is the strong signal (they pressed Notify me);
// "Opened" is curiosity. The gap between them tells you whether the idea, or just the tile, is what people liked.
const META = {
  pay: { icon: Wallet, tint: C.primary, soft: C.primarySoft, blurb: "All UPI payments — scan & pay, mobile number, UPI ID — built for moi and shagun." },
  bills: { icon: Receipt, tint: C.warning, soft: C.warningSoft, blurb: "Family bill reminders and payments in one place." },
  vendors: { icon: Store, tint: "#7457D1", soft: "#F1EEFC", blurb: "Find trusted caterers, photographers, halls and decorators." },
};

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso); const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return Math.max(mins, 1) + " min ago";
  if (mins < 1440) return Math.round(mins / 60) + " h ago";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const Big = ({ label, value, sub, tone }) => (
  <div>
    <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: tone || C.text, lineHeight: 1.15, marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{sub}</div>}
  </div>
);

function FeatureCard({ f }) {
  const [open, setOpen] = useState(false);
  const m = META[f.id] || META.pay; const Icon = m.icon;
  const rate = f.tapped ? Math.round((f.notify / f.tapped) * 100) : null;
  return (
    <div className="rf-card" style={{ padding: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: m.soft, color: m.tint, display: "grid", placeItems: "center" }}><Icon size={20} /></div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{f.label}</div>
          <div style={{ fontSize: 12, color: C.sub }}>{m.blurb}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Big label="Asked to be notified" value={f.notify} tone={m.tint} sub={f.notify7d ? "+" + f.notify7d + " in the last 7 days" : "none in the last 7 days"} />
        <Big label="Opened the tile" value={f.tapped} sub={rate === null ? "—" : rate + "% asked to be notified"} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: C.sub }}>"Notify me" over the last 14 days</span>
        <Sparkline data={f.daily} color={m.tint} />
      </div>
      <div>
        <button onClick={() => setOpen(!open)} style={{ border: "none", background: "transparent", color: C.primary, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
          {open ? "Hide" : "Show"} who asked ({f.notify})
        </button>
        {open && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {f.recent.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>Nobody has pressed Notify me yet.</div>}
            {f.recent.map((r) => (
              <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={r.name || "?"} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{r.mobile}{r.place ? " · " + r.place : ""}</div>
                </div>
                <div style={{ fontSize: 11.5, color: C.sub }}>{when(r.at)}</div>
              </div>
            ))}
            {f.notify > f.recent.length && <div style={{ fontSize: 11.5, color: C.sub }}>Showing the latest {f.recent.length}.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeatureInterestScreen({ data, onRefresh }) {
  if (!data) return <div className="rf-card" style={{ padding: 24, color: C.sub }}>Could not load feature interest. It may need the app server to have started once (it creates the table).</div>;
  const pct = data.totalUsers ? Math.round((data.distinctNotify / data.totalUsers) * 100) : 0;
  const ranked = [...data.features].sort((a, b) => b.notify - a.notify);
  const leader = ranked[0] && ranked[0].notify > 0 ? ranked[0] : null;
  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: C.sub }}>People who asked to be notified</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: C.primary }}>{data.distinctNotify}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{pct}% of all {data.totalUsers} users (each person counted once)</div>
        </div>
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: C.sub }}>People who opened a tile</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{data.distinctTapped}</div>
        </div>
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: C.sub }}>Most wanted so far</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{leader ? leader.label : "—"}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{leader ? leader.notify + " asked to be notified" : "Waiting for the first taps"}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
        {data.features.map((f) => <FeatureCard key={f.id} f={f} />)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.sub }}>
        <button onClick={onRefresh} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid " + C.border, background: "#fff", borderRadius: 10, padding: "7px 12px", cursor: "pointer", fontWeight: 600, color: C.text }}>
          <RefreshCw size={14} /> Refresh
        </button>
        The tiles appear on the Home screen of every phone that has the updated app.
      </div>
    </div>
  );
}
