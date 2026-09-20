import React, { useState, useMemo, useEffect } from "react";
import { X, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, ChevronsUpDown, Filter } from "lucide-react";
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

/* ---------- Every table: click a heading to sort, filter the whole table or single columns ----------
   Done once here, so every screen that uses TableCard gets it without changing. The text of each cell is read from the row the screen
   renders (renderRow), so sorting and filtering follow exactly what is shown: numbers and ₹ amounts sort as numbers, dates as dates,
   everything else alphabetically (with 10 after 9). Empty cells always go last. */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function nodeText(n) {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join(" ");
  if (React.isValidElement(n)) {
    const p = n.props || {};
    if (typeof n.type === "string") return nodeText(p.children);
    // components: Chip carries its words in "text"; avatars/icons contribute nothing
    return [p.text, p.label, nodeText(p.children)].filter(Boolean).join(" ");
  }
  return "";
}
// The cells of the first <tr> inside whatever a screen's renderRow returned (it may wrap a row and its detail row in a Fragment).
function findRowCells(el) {
  if (!React.isValidElement(el)) return [];
  if (el.type === "tr") return React.Children.toArray(el.props.children).filter((c) => React.isValidElement(c) && (c.type === "td" || c.type === "th"));
  return React.Children.toArray((el.props && el.props.children) || []).reduce((found, c) => (found.length ? found : findRowCells(c)), []);
}
function sortValue(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t === "" || t === "—" || t === "-") return { k: 2, v: 0 };
  const plain = t.replace(/[₹$€£,%\s]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(plain)) return { k: 0, v: Number(plain) };
  const d = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (d && MONTHS[d[2].slice(0, 3).toLowerCase()] !== undefined) return { k: 0, v: Date.UTC(Number(d[3]), MONTHS[d[2].slice(0, 3).toLowerCase()], Number(d[1])) };
  if (/^\d{4}-\d{2}-\d{2}/.test(t) && !Number.isNaN(Date.parse(t))) return { k: 0, v: Date.parse(t) };
  return { k: 1, v: t.toLowerCase() };
}
function compareValues(a, b) {
  if (a.k !== b.k) return a.k - b.k;
  if (a.k === 0) return a.v - b.v;
  if (a.k === 1) return a.v.localeCompare(b.v, undefined, { numeric: true });
  return 0;
}

export const TableCard = ({ columns, rows, renderRow, controls, footer, empty }) => {
  const [sort, setSort] = useState(null); // { col, dir: "asc" | "desc" }
  const [q, setQ] = useState("");
  const [showColFilters, setShowColFilters] = useState(false);
  const [colFilters, setColFilters] = useState({});
  const sig = columns.join("|");
  useEffect(() => { setSort(null); setQ(""); setShowColFilters(false); setColFilters({}); }, [sig]);

  const items = useMemo(() => rows.map((r, i, a) => {
    const el = renderRow(r, i, a);
    const cells = findRowCells(el).map(nodeText);
    return { el, cells, keys: cells.map(sortValue) };
  }), [rows, renderRow]);

  const ql = q.trim().toLowerCase();
  const colActive = Object.values(colFilters).some((v) => v && v.trim());
  const filtering = !!ql || colActive;
  let view = items;
  if (filtering) {
    view = items.filter((it) => {
      if (ql && !it.cells.join(" ").toLowerCase().includes(ql)) return false;
      for (const [ci, v] of Object.entries(colFilters)) {
        if (v && v.trim() && !(it.cells[ci] || "").toLowerCase().includes(v.trim().toLowerCase())) return false;
      }
      return true;
    });
  }
  if (sort) {
    const dir = sort.dir === "asc" ? 1 : -1;
    view = [...view].sort((x, y) => {
      const a = x.keys[sort.col] || { k: 2, v: 0 }, b = y.keys[sort.col] || { k: 2, v: 0 };
      if (a.k === 2 || b.k === 2) return a.k === b.k ? 0 : (a.k === 2 ? 1 : -1); // empty cells stay at the bottom in both directions
      return dir * compareValues(a, b);
    });
  }
  const toggleSort = (col) => setSort((cur) => (!cur || cur.col !== col ? { col, dir: "asc" } : cur.dir === "asc" ? { col, dir: "desc" } : null));
  const clearAll = () => { setSort(null); setQ(""); setColFilters({}); };
  const sortIcon = (i) => (sort && sort.col === i ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />);

  return (
    <div className="rf-card" style={{ overflow: "hidden" }}>
      {controls && <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{controls}</div>}
      <div className="rf-table-tools" style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="rf-input plain" placeholder="Filter this table…" aria-label="Filter this table" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220, padding: "8px 12px" }} />
        <button className="rf-btn ghost" onClick={() => setShowColFilters((v) => !v)} style={{ padding: "7px 12px", fontSize: 12.5 }} aria-pressed={showColFilters}><Filter size={13} /> Column filters</button>
        {(filtering || sort) && <button className="rf-btn ghost" onClick={clearAll} style={{ padding: "7px 12px", fontSize: 12.5 }}><X size={13} /> Clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.sub }}>
          {sort ? `Sorted by ${columns[sort.col]} · ${sort.dir === "asc" ? "A → Z / low → high" : "Z → A / high → low"}` : "Click a column heading to sort"}
        </span>
      </div>
      <div style={{ overflowX: "auto", maxHeight: 520 }}>
        <table className="rf-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                c ? (
                  <th key={c} onClick={() => toggleSort(i)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title={`Sort by ${c}`}
                    aria-sort={sort && sort.col === i ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{c}{sortIcon(i)}</span>
                  </th>
                ) : <th key={i} />
              ))}
            </tr>
            {showColFilters && (
              <tr className="rf-col-filters">
                {columns.map((c, i) => (
                  <th key={i} style={{ position: "static", padding: "6px 8px", background: "#fff" }}>
                    {c ? <input className="rf-input plain" placeholder="Filter…" aria-label={`Filter ${c}`} value={colFilters[i] || ""} onChange={(e) => setColFilters((cur) => ({ ...cur, [i]: e.target.value }))} style={{ width: "100%", minWidth: 70, padding: "5px 8px", fontSize: 12 }} /> : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>{view.map((it) => it.el)}</tbody>
        </table>
      </div>
      {view.length === 0 && (rows.length === 0 ? empty : "No rows match the table filter.") && (
        <div style={{ padding: 30, textAlign: "center", color: C.sub, fontSize: 13 }}>{rows.length === 0 ? empty : "No rows match the table filter."}</div>
      )}
      <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.sub, gap: 12, flexWrap: "wrap" }}>
        {footer ? footer : <span>{`Showing ${view.length} of ${rows.length} records`}</span>}
        {filtering && <span>{`Table filter: ${view.length} of ${rows.length} shown`}</span>}
      </div>
    </div>
  );
};

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
