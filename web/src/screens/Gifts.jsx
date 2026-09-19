import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { C, inr } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

export const GiftsScreen = ({ gifts, openDrawer }) => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const rows = gifts.filter((g) => {
    const mq = !q || (g.id + " " + g.sender + " " + g.receiver).toLowerCase().includes(q.toLowerCase());
    const mf = filter === "All" || g.type === filter || g.status === filter || (filter === "> ₹10,000" && g.amount > 10000);
    return mq && mf;
  });
  return (
    <div className="rf-fade">
      <TableCard
        columns={["Sender", "Receiver", "Event", "Amount", "Payment", "Date", "Status"]}
        rows={rows}
        empty="No gift records match this search/filter."
        controls={<>
          <SearchBox placeholder="Search sender, receiver…" value={q} onChange={setQ} />
          <FilterChips items={["All", "Cash", "UPI", "Bank", "> ₹10,000", "Pending", "Complete"]} active={filter} onSelect={setFilter} />
        </>}
        footer={`Showing ${rows.length} records · Click a row for transaction details`}
        renderRow={(g) => (
          <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => openDrawer(g.id)}>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={g.sender} size={26} />{g.sender}</div></td>
            <td>{g.receiver}</td>
            <td style={{ color: C.sub }}>{g.event}</td>
            <td style={{ fontWeight: 700 }}>{inr(g.amount)}</td>
            <td><Chip text={g.type} tone={[C.sub, "#F3F4F6"]} /></td>
            <td style={{ color: C.sub }}>{g.date}</td>
            <td><Chip text={g.status} /></td>
          </tr>
        )}
      />
    </div>
  );
};

export const GiftDrawer = ({ gift, close, onSetStatus }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,.4)", backdropFilter: "blur(2px)" }} onClick={close} />
    <div className="rf-drawer" style={{ position: "relative", width: 420, maxWidth: "92vw", background: "#fff", height: "100%", boxShadow: "-16px 0 48px rgba(17,24,39,.15)", padding: 26, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Transaction Details</h3>
        <button className="rf-icon-btn" onClick={close}><X size={16} /></button>
      </div>
      <div style={{ marginTop: 22, background: C.goldSoft, borderRadius: 16, padding: 22, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.sub }}>Moi Amount</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "-0.02em" }}>{inr(gift.amount)}</div>
        <div style={{ marginTop: 8 }}><Chip text={gift.status} /></div>
      </div>
      <div style={{ marginTop: 22 }}>
        {[["Sender", gift.sender], ["Receiver", gift.receiver], ["Event", gift.event], ["Payment Type", gift.type], ["Date", gift.date]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
            <span style={{ color: C.sub, flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {gift.status !== "Complete" && <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSetStatus(gift, "Complete")}><CheckCircle2 size={14} /> Mark Complete</button>}
        {gift.status !== "Flagged" && <button className="rf-btn ghost" style={{ flex: 1, justifyContent: "center", color: C.error }} onClick={() => onSetStatus(gift, "Flagged")}><AlertCircle size={14} /> Flag</button>}
        {gift.status === "Flagged" && <button className="rf-btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => onSetStatus(gift, "Pending")}>Move to Pending</button>}
      </div>
    </div>
  </div>
);
