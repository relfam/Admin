import React, { useEffect, useState } from "react";
import { Pin, CheckCircle2, AlertTriangle, XCircle, ExternalLink, ChevronDown } from "lucide-react";
import { C } from "../theme";
import { api } from "../api";

// Pinned above every screen (AdminDashboard): the outside services Relfam pays for or depends on. Open while anything
// is still unchecked today; once all are ticked it folds into one green line (tap to reopen). What the server can see
// for itself (codes failing, domain / VPS / certificate expiry) is shown in each row — see server/dailyChecks.js.
const LEVEL = {
  ok: { color: C.success, soft: C.successSoft, Icon: CheckCircle2, label: "OK" },
  warn: { color: C.warning, soft: C.warningSoft, Icon: AlertTriangle, label: "Look" },
  bad: { color: C.error, soft: C.errorSoft, Icon: XCircle, label: "Problem" },
};

function Row({ item, onMark, onSaveVps, busy }) {
  const L = LEVEL[item.level] || LEVEL.warn;
  const [vps, setVps] = useState(item.vpsRenewal || "");
  return (
    <div style={{ display: "flex", gap: 14, padding: "14px 0", borderTop: `1px solid #F1F3F6`, alignItems: "flex-start", flexWrap: "wrap" }}>
      <span title={L.label} style={{ width: 30, height: 30, borderRadius: 10, background: L.soft, color: L.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><L.Icon size={16} /></span>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.name}</div>
        {item.facts.map((f, i) => <div key={i} style={{ fontSize: 12.5, color: /FAILED|could not|not set/i.test(f) ? C.error : C.sub, marginTop: 3, overflowWrap: "anywhere" }}>{f}</div>)}
        <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{item.todo}</div>
        {item.id === "namecheap" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: C.sub }} htmlFor="vpsRenewal">VPS renewal date</label>
            <input id="vpsRenewal" type="date" value={vps} onChange={(e) => setVps(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12.5 }} />
            <button className="rf-btn ghost" style={{ padding: "5px 12px", fontSize: 12 }} disabled={busy || !vps || vps === item.vpsRenewal} onClick={() => onSaveVps(vps)}>Save date</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        <a className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12, textDecoration: "none" }} href={item.link} target="_blank" rel="noreferrer">{item.linkLabel} <ExternalLink size={13} /></a>
        {item.checkedToday
          ? <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>✓ Checked by {item.checkedBy} at {new Date(item.checkedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
          : <button className="rf-btn primary" style={{ padding: "6px 14px", fontSize: 12 }} disabled={busy} onClick={() => onMark(item.id)}>Mark checked</button>}
      </div>
    </div>
  );
}

export default function DailyChecks() {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);   // this admin has no System Health access: no card at all
  const [open, setOpen] = useState(null);        // null = decide from what is left to check
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.dailyChecks().then((d) => { setData(d); setError(""); })
    .catch((e) => { if (/No access/i.test(e.message)) setHidden(true); else setError(e.message); });
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const act = async (fn) => { setBusy(true); try { setData(await fn()); setError(""); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (hidden) return null;
  if (!data) return error ? <div className="rf-card" style={{ padding: "12px 18px", marginBottom: 18, fontSize: 12.5, color: C.error }}>Daily checks: {error}</div> : null;

  const problems = data.items.filter((i) => i.level === "bad").length;
  const looks = data.items.filter((i) => i.level === "warn").length;
  const allDone = data.remaining === 0;
  const isOpen = open === null ? !allDone || problems > 0 : open;
  const tone = problems ? LEVEL.bad : allDone && !looks ? LEVEL.ok : LEVEL.warn;
  const summary = allDone
    ? `All daily checks done today${problems ? ` — but ${problems} still show a problem` : looks ? ` — ${looks} to keep an eye on` : " ✓"}`
    : `${data.remaining} of ${data.items.length} still to check today${problems ? ` · ${problems} problem${problems > 1 ? "s" : ""}` : ""}`;

  return (
    <div className="rf-card" style={{ marginBottom: 20, borderColor: tone.color, borderLeftWidth: 4, padding: isOpen ? "16px 20px 6px" : "10px 20px" }}>
      <button onClick={() => setOpen(!isOpen)} aria-expanded={isOpen} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
        <Pin size={16} color={tone.color} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 14 }}>Daily checks</span>
        <span style={{ fontSize: 12.5, color: tone.color, fontWeight: 600 }}>{summary}</span>
        <ChevronDown size={16} style={{ marginLeft: "auto", color: C.sub, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {error && <div style={{ fontSize: 12.5, color: C.error, marginTop: 8 }}>{error}</div>}
      {isOpen && (
        <div style={{ marginTop: 10 }}>
          {data.items.map((item) => (
            <Row key={item.id} item={item} busy={busy}
              onMark={(id) => act(() => api.markDailyCheck(id))}
              onSaveVps={(date) => act(() => api.setVpsRenewal(date))} />
          ))}
        </div>
      )}
    </div>
  );
}
