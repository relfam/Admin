import React, { useMemo, useState } from "react";
import { CheckCircle2, Search, ClipboardList } from "lucide-react";
import { C } from "../theme";
import { Field } from "./shared";

// Max tokens accepted in one paste — a sanity cap, not a backend limit (the API itself takes any
// size array), just to keep one paste from freezing the tab on a mistaken multi-megabyte clipboard
// dump.
const BULK_PASTE_LIMIT = 10000;

// Searchable + multi-select user picker, shared by Ads' "Target user" and Notifications'
// "Specific user" audience — a plain <select> stops being usable once there are more than a
// handful of users, and both screens need to target more than one person at a time anyway.
export default function UserMultiSelect({ users, selected, onChange, label = "Target users" }) {
  const [q, setQ] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return users;
    return users.filter((u) => [u.name, u.uid, u.mobile, u.email].join(" ").toLowerCase().includes(ql));
  }, [q, users]);

  // Lookup maps built once per `users` change, not per paste — a 10k-entry paste against an O(n)
  // scan per entry would be 10k * users.length comparisons; this makes each entry O(1) instead.
  const { byUid, byMobile } = useMemo(() => {
    const uidMap = new Map();
    const mobileMap = new Map();
    for (const u of users) {
      if (u.uid) uidMap.set(String(u.uid).toLowerCase(), u.id);
      const bareMobile = String(u.mobile || "").replace(/\D/g, "").slice(-10);
      if (bareMobile.length === 10) mobileMap.set(bareMobile, u.id);
    }
    return { byUid: uidMap, byMobile: mobileMap };
  }, [users]);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const selectAllFiltered = () => {
    const merged = new Set([...selected, ...filtered.map((u) => u.id)]);
    onChange([...merged]);
  };

  // Accepts mobile numbers or "RLF-xxxxx" UIDs, separated by commas, spaces, or newlines — matches
  // whatever format an admin already has a list in (an export, a support ticket, a pasted column
  // from a spreadsheet) rather than requiring one specific format.
  const applyBulkPaste = () => {
    const tokens = bulkText.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).slice(0, BULK_PASTE_LIMIT);
    const matchedIds = new Set();
    const notFound = [];
    for (const token of tokens) {
      const asUid = token.toLowerCase();
      const asMobile = token.replace(/\D/g, "").slice(-10);
      const id = byUid.get(asUid) ?? (asMobile.length === 10 ? byMobile.get(asMobile) : undefined);
      if (id !== undefined) matchedIds.add(id);
      else notFound.push(token);
    }
    const alreadySelected = new Set(selected);
    const newlyAdded = [...matchedIds].filter((id) => !alreadySelected.has(id));
    onChange([...selected, ...newlyAdded]);
    setBulkResult({ total: tokens.length, added: newlyAdded.length, alreadyHad: matchedIds.size - newlyAdded.length, notFound });
    setBulkText("");
  };

  return (
    <Field label={`${label} (${selected.length ? selected.length + " selected" : "none picked yet"})`}>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={15} style={{ position: "absolute", left: 14, top: 12, color: C.sub }} />
        <input className="rf-input" placeholder="Search name, mobile, email, UID…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ display: "grid", gap: 4, maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12, padding: 8 }}>
        {filtered.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.sub, textAlign: "center" }}>No users match "{q}".</div>}
        {filtered.map((u) => {
          const on = selected.includes(u.id);
          return (
            <button key={u.id} type="button" onClick={() => toggle(u.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600, textAlign: "left", border: "1px solid " + (on ? C.primary : C.border), background: on ? C.primarySoft : "#fff", color: on ? C.primary : C.text }}>
              {on ? <CheckCircle2 size={13} style={{ flexShrink: 0 }} /> : <span style={{ width: 13, flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.uid} — {u.name}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={selectAllFiltered}>Select all{q ? " (filtered)" : ""}</button>
        {selected.length > 0 && <button type="button" className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => onChange([])}>Clear</button>}
        <button type="button" className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 5 }} onClick={() => { setBulkOpen((v) => !v); setBulkResult(null); }}>
          <ClipboardList size={13} /> Paste list
        </button>
      </div>
      {bulkOpen && (
        <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 6 }}>
            Paste mobile numbers or UIDs (e.g. RLF-10128) — comma, space, or newline separated, up to {BULK_PASTE_LIMIT.toLocaleString()} at once.
          </div>
          <textarea
            className="rf-input"
            style={{ width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
            placeholder="9876543210, RLF-10128, 9123456780..."
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="rf-btn primary" style={{ padding: "6px 14px", fontSize: 12 }} disabled={!bulkText.trim()} onClick={applyBulkPaste}>Add to selection</button>
          </div>
          {bulkResult && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: C.text }}>
              Added {bulkResult.added} of {bulkResult.total} entries
              {bulkResult.alreadyHad > 0 ? ` (${bulkResult.alreadyHad} already selected)` : ""}.
              {bulkResult.notFound.length > 0 && (
                <div style={{ marginTop: 4, color: C.sub }}>
                  {bulkResult.notFound.length} not found: {bulkResult.notFound.slice(0, 8).join(", ")}
                  {bulkResult.notFound.length > 8 ? `, +${bulkResult.notFound.length - 8} more` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
