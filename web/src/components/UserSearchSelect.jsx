import React, { useMemo, useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { C } from "../theme";

// Single-user searchable combobox — replaces a plain <select> once there are more users than fit
// comfortably in a native dropdown. Type to filter by name/UID/mobile/email; click a result to
// pick it. Used by Fraud's "Log Fraud/Spam Case" user field.
export default function UserSearchSelect({ users, value, onChange, placeholder = "Select user…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedUser = useMemo(() => users.find((u) => String(u.id) === String(value)) || null, [users, value]);

  const filtered = useMemo(() => {
    const ql = query.trim().toLowerCase();
    if (!ql) return users;
    return users.filter((u) => [u.name, u.uid, u.mobile, u.email, u.city].join(" ").toLowerCase().includes(ql));
  }, [query, users]);

  const pick = (u) => {
    onChange(u.id);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={15} style={{ position: "absolute", left: 14, top: 12, color: C.sub }} />
        <input
          className="rf-input"
          style={{ paddingRight: selectedUser ? 60 : 34 }}
          placeholder={selectedUser ? `${selectedUser.uid} — ${selectedUser.name}` : placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {selectedUser && !query && (
          <button type="button" onClick={clear} title="Clear" aria-label="Clear selected user"
            style={{ position: "absolute", right: 30, top: 9, background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 2 }}>
            <X size={15} />
          </button>
        )}
        <ChevronDown size={15} style={{ position: "absolute", right: 12, top: 12, color: C.sub, pointerEvents: "none" }} />
      </div>
      {open && (
        <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 220, overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.sub, textAlign: "center" }}>No users match "{query}".</div>}
          {filtered.map((u) => {
            const on = selectedUser && String(selectedUser.id) === String(u.id);
            return (
              <button key={u.id} type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, border: "none", background: on ? C.primarySoft : "transparent", color: on ? C.primary : C.text }}>
                <div style={{ fontWeight: 600 }}>{u.uid} — {u.name}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{u.mobile} · {u.city}</div>
              </button>
            );
          })}
        </div>
      )}
      {open && <div onMouseDown={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />}
    </div>
  );
}
