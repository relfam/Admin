import React, { useMemo, useState } from "react";
import { Search, Users, CalendarDays, Gift, LifeBuoy, CreditCard } from "lucide-react";
import { C } from "../theme";
import { Chip } from "./shared";

export default function GlobalSearch({ users, events, gifts, tickets, subs, go, openUser, openGift }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const ql = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!ql) return null;
    const has = (s) => String(s || "").toLowerCase().includes(ql);
    return {
      users: users.filter((u) => has(u.name) || has(u.uid) || has(u.email) || has(u.mobile) || has(u.city)).slice(0, 4),
      events: events.filter((e) => has(e.name) || has(e.host) || has(e.type)).slice(0, 3),
      gifts: gifts.filter((g) => has(g.id) || has(g.sender) || has(g.receiver)).slice(0, 3),
      tickets: tickets.filter((t) => has(t.id) || has(t.user) || has(t.cat)).slice(0, 3),
      subs: subs.filter((s) => has(s.id) || has(s.user) || has(s.pkg)).slice(0, 3),
    };
  }, [ql, users, events, gifts, tickets, subs]);

  const total = results ? Object.values(results).reduce((a, arr) => a + arr.length, 0) : 0;
  const pick = (fn) => { fn(); setQ(""); setFocused(false); };

  const Group = ({ label, items, render }) => items.length === 0 ? null : (
    <div style={{ padding: "6px 0" }}>
      <div style={{ padding: "4px 16px", fontSize: 10.5, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>
      {items.map(render)}
    </div>
  );

  const Row = ({ icon: Icon, tint, soft, title, sub, chip, onClick }) => (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.primarySoft)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={14} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </span>
      {chip && <Chip text={chip} />}
    </button>
  );

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 460 }}>
      <Search size={15} style={{ position: "absolute", left: 14, top: 12, color: C.sub, zIndex: 1 }} />
      <input className="rf-input" placeholder="Search users, events, gifts, tickets, subscriptions…" value={q}
        onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)} />
      {focused && ql && (
        <div className="rf-pop" style={{ position: "absolute", top: 46, left: 0, right: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: "0 20px 48px rgba(17,24,39,.16)", maxHeight: 440, overflowY: "auto", zIndex: 50 }}>
          {total === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: C.sub, textAlign: "center" }}>No results for "{q}".</div>
          ) : (
            <>
              <Group label="Users" items={results.users} render={(u) => (
                <Row key={u.id} icon={Users} tint={C.primary} soft={C.primarySoft} title={u.name} sub={`${u.uid} · ${u.mobile} · ${u.city}`} chip={u.status} onClick={() => pick(() => openUser(u.id))} />
              )} />
              <Group label="Events" items={results.events} render={(e) => (
                <Row key={e.id} icon={CalendarDays} tint={C.gold} soft={C.goldSoft} title={e.name} sub={`${e.host} · ${e.date}`} chip={e.status} onClick={() => pick(() => go("events"))} />
              )} />
              <Group label="Gift Records" items={results.gifts} render={(g) => (
                <Row key={g.id} icon={Gift} tint="#E48BA5" soft="#FDF1F4" title={`${g.event} · ₹${g.amount}`} sub={`${g.sender} → ${g.receiver}`} chip={g.status} onClick={() => pick(() => openGift(g.id))} />
              )} />
              <Group label="Tickets" items={results.tickets} render={(t) => (
                <Row key={t.id} icon={LifeBuoy} tint={C.error} soft={C.errorSoft} title={`${t.id} · ${t.cat}`} sub={`${t.user} · ${t.assigned}`} chip={t.status} onClick={() => pick(() => go("support"))} />
              )} />
              <Group label="Subscriptions" items={results.subs} render={(s) => (
                <Row key={s.id} icon={CreditCard} tint={C.success} soft={C.successSoft} title={`${s.id} · ${s.pkg}`} sub={`${s.user} · ${s.activated}`} chip={s.status} onClick={() => pick(() => go("payments"))} />
              )} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
