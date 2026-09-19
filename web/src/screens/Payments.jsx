import React, { useState } from "react";
import { CheckCircle2, AlertCircle, CalendarDays, Crown, RefreshCw, Star, Zap } from "lucide-react";
import { C, inr, PACKAGE_STYLE } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

const PKG_ICON = { regular: Star, pro: Zap, advanced: Crown };

export default function PaymentsScreen({ packages, subs, users, onRetry, onDeactivate, onReactivate }) {
  const [pkgFilter, setPkgFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [q, setQ] = useState("");

  const count = (fn) => subs.filter(fn).length;
  const kpis = [
    ["Activated Today", count((s) => s.when === "today" && s.status === "Active"), C.success, C.successSoft, CheckCircle2],
    ["This Week", count((s) => (s.when === "today" || s.when === "week") && s.status === "Active"), C.primary, C.primarySoft, CalendarDays],
    ["This Month", count((s) => s.when !== "older" && s.status === "Active"), C.gold, C.goldSoft, Crown],
    ["Failed Payments", count((s) => s.status === "Failed"), C.error, C.errorSoft, AlertCircle],
  ];

  const rows = subs.filter((s) => {
    const mp = pkgFilter === "All" || s.pkg?.toLowerCase() === pkgFilter;
    const ms = statusFilter === "All" || s.status === statusFilter;
    const mq = !q || (s.user + " " + s.id).toLowerCase().includes(q.toLowerCase());
    return mp && ms && mq;
  });

  const pkgCount = (id) => users.filter((u) => u.pkg.toLowerCase() === id).length;

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {kpis.map(([k, v, tint, soft, Icon]) => (
          <div key={k} className="rf-card hoverable" style={{ padding: 18, cursor: "pointer" }} onClick={() => setStatusFilter(k === "Failed Payments" ? "Failed" : "Active")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12.5, color: C.sub }}>{k}</div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: tint, marginTop: 8 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{k === "Failed Payments" ? "tap to view failed" : "activations"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {packages.map((p) => {
          const style = PACKAGE_STYLE[p.id] || PACKAGE_STYLE.regular;
          const Icon = PKG_ICON[p.id] || Star;
          const active = pkgFilter === p.id;
          return (
            <div key={p.id} className="rf-card hoverable" style={{ padding: 22, border: active ? `2px solid ${style.tint}` : `1px solid ${C.border}`, cursor: "pointer" }} onClick={() => setPkgFilter(active ? "All" : p.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: style.soft, color: style.tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} /></div>
                <Chip text={`${pkgCount(p.id)} users`} tone={[style.tint, style.soft]} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, marginTop: 14 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: style.tint }}>{p.price === 0 ? "₹0" : inr(p.price)}</span>
                <span style={{ fontSize: 12, color: C.sub }}>{p.billing_period === "forever" ? "free forever" : "per " + p.billing_period}</span>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {(p.features || []).map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.sub }}>
                    <CheckCircle2 size={13} style={{ color: style.tint, flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: active ? style.tint : C.sub, fontWeight: 600, marginTop: 14 }}>
                {active ? "Filtering table by this package — tap to clear" : "Tap to filter subscriptions"}
              </div>
            </div>
          );
        })}
      </div>

      <TableCard
        columns={["Sub ID", "User", "Package", "Amount", "Method", "Activated", "Expires", "Status", "Actions"]}
        rows={rows}
        empty="No subscriptions yet."
        controls={<>
          <SearchBox placeholder="Search user or sub ID…" value={q} onChange={setQ} />
          <FilterChips items={["All", "Active", "Inactive", "Failed"]} active={statusFilter} onSelect={setStatusFilter} />
        </>}
        footer={`Showing ${rows.length} of ${subs.length} subscriptions${pkgFilter !== "All" ? ` · Package: ${pkgFilter}` : ""}`}
        renderRow={(s) => (
          <tr key={s.id}>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, color: C.primary }}>{s.id}</td>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={s.user} size={26} />{s.user}</div></td>
            <td><Chip text={s.pkg} /></td>
            <td style={{ fontWeight: 700 }}>{s.amount ? inr(s.amount) : "Free"}</td>
            <td style={{ color: C.sub }}>{s.method}</td>
            <td style={{ color: C.sub }}>{s.activated}</td>
            <td style={{ color: C.sub }}>{s.expires}</td>
            <td><Chip text={s.status} /></td>
            <td>
              {s.status === "Failed" && <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onRetry(s.rawId)}><RefreshCw size={12} /> Retry</button>}
              {s.status === "Active" && s.amount > 0 && <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 12, color: C.error }} onClick={() => onDeactivate(s.rawId)}>Deactivate</button>}
              {s.status === "Inactive" && <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 12, color: C.success }} onClick={() => onReactivate(s.rawId)}>Reactivate</button>}
            </td>
          </tr>
        )}
      />
    </div>
  );
}
