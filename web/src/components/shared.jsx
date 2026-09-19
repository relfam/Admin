import React from "react";
import { X, ToggleLeft, ToggleRight } from "lucide-react";
import { C, AV_COLORS } from "../theme";

export const Avatar = ({ name, size = 34 }) => {
  const safe = name || "?";
  const initials = safe.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const bg = AV_COLORS[safe.length % AV_COLORS.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg + "22", color: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
};

const CHIP_MAP = {
  Active: [C.success, C.successSoft], Verified: [C.success, C.successSoft], Completed: [C.success, C.successSoft], Complete: [C.success, C.successSoft], Resolved: [C.success, C.successSoft], Success: [C.success, C.successSoft], Paid: [C.success, C.successSoft], Published: [C.success, C.successSoft], Actioned: [C.success, C.successSoft],
  Live: [C.primary, C.primarySoft], "In Progress": [C.primary, C.primarySoft], New: [C.primary, C.primarySoft], "Under Review": [C.primary, C.primarySoft],
  Upcoming: [C.warning, C.warningSoft], Pending: [C.warning, C.warningSoft], Old: [C.warning, C.warningSoft], Medium: [C.warning, C.warningSoft], Inactive: [C.warning, C.warningSoft], Draft: [C.warning, C.warningSoft],
  Blocked: [C.error, C.errorSoft], Suspended: [C.error, C.errorSoft], Flagged: [C.error, C.errorSoft], Open: [C.error, C.errorSoft], High: [C.error, C.errorSoft], Failed: [C.error, C.errorSoft],
  Low: [C.sub, "#F3F4F6"], Dismissed: [C.sub, "#F3F4F6"],
  Pro: [C.primary, C.primarySoft], Advanced: [C.gold, C.goldSoft], Regular: [C.sub, "#F3F4F6"],
  Admin: [C.gold, C.goldSoft], Member: [C.primary, C.primarySoft], Guest: [C.sub, "#F3F4F6"],
};

export const Chip = ({ text, tone }) => {
  const [color, bg] = tone || CHIP_MAP[text] || [C.sub, "#F3F4F6"];
  return <span className="rf-chip" style={{ color, background: bg }}>{text}</span>;
};

export const Sparkline = ({ data, color }) => {
  const safe = data && data.length ? data : [0, 0];
  const max = Math.max(...safe), min = Math.min(...safe);
  const pts = safe.map((v, i) => `${(i / (safe.length - 1 || 1)) * 64},${22 - ((v - min) / (max - min || 1)) * 20}`).join(" ");
  return (
    <svg width="64" height="24" style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SectionCard = ({ title, action, children, style }) => (
  <div className="rf-card" style={{ padding: 22, ...style }}>
    {title && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
        {action}
      </div>
    )}
    {children}
  </div>
);

export const TableCard = ({ columns, rows, renderRow, controls, footer, empty }) => (
  <div className="rf-card" style={{ overflow: "hidden" }}>
    {controls && <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{controls}</div>}
    <div style={{ overflowX: "auto", maxHeight: 520 }}>
      <table className="rf-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
    {rows.length === 0 && empty && <div style={{ padding: 30, textAlign: "center", color: C.sub, fontSize: 13 }}>{empty}</div>}
    <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.sub }}>
      {footer ? footer : <span>{`Showing ${rows.length} of ${rows.length} records`}</span>}
    </div>
  </div>
);

export const SearchBox = ({ placeholder, width = 260, value, onChange }) => (
  <div style={{ position: "relative", width }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" style={{ position: "absolute", left: 14, top: 12 }}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input className="rf-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const FilterChips = ({ items, active, onSelect }) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {items.map((f) => (
      <button key={f} className="rf-chip" onClick={() => onSelect(f)}
        style={{ cursor: "pointer", border: `1px solid ${active === f ? C.primary : C.border}`, background: active === f ? C.primarySoft : "#fff", color: active === f ? C.primary : C.sub }}>{f}</button>
    ))}
  </div>
);

export const Toggle = ({ on, onClick }) => (
  <button onClick={onClick} style={{ border: "none", background: "none", cursor: "pointer", color: on ? C.success : C.sub, display: "flex", alignItems: "center" }} title={on ? "Turn off" : "Turn on"}>
    {on ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
  </button>
);

export const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

export const Modal = ({ title, close, children, width = 480 }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,.45)", backdropFilter: "blur(3px)" }} onClick={close} />
    <div className="rf-pop" style={{ position: "relative", width, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: 20, padding: 26, boxShadow: "0 24px 64px rgba(17,24,39,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <button className="rf-icon-btn" onClick={close}><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>
);
