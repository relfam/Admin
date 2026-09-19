import React, { useState } from "react";
import { ShieldAlert, AlertTriangle, Eye, Ban, RefreshCw, ChevronRight as ChevIcon, Sparkles, Plus, Search } from "lucide-react";
import { C } from "../theme";
import { Avatar, Chip, FilterChips, Field, Modal } from "../components/shared";
import UserSearchSelect from "../components/UserSearchSelect";

const CASE_TYPES = ["Spam gift entries", "Fake payment claim", "Abusive content", "QR scan anomaly", "Entry velocity spike", "Other"];

export default function FraudScreen({ cases, users, onSuspend, openUser, onSetStatus, onCreate, onScan }) {
  const [openId, setOpenId] = useState(cases.find((c) => c.status === "New")?.id || null);
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const blank = { userId: "", type: CASE_TYPES[0], severity: "Medium", evidence: "", signal: "" };
  const [form, setForm] = useState(blank);
  const rows = cases.filter((c) => filter === "All" || c.status === filter);
  const sevTone = { High: [C.error, C.errorSoft], Medium: [C.warning, C.warningSoft], Low: [C.sub, "#F3F4F6"] };

  const createCase = async () => {
    if (!form.userId) return;
    await onCreate({ userId: Number(form.userId), type: form.type, severity: form.severity, evidence: form.evidence, signal: form.signal });
    setForm(blank);
    setShowNew(false);
  };

  const runScan = async () => {
    setScanning(true);
    setScanMsg("");
    try {
      const result = await onScan();
      setScanMsg(result.found > 0 ? `Scan complete — found ${result.found} new case${result.found === 1 ? "" : "s"}.` : "Scan complete — no suspicious activity found.");
    } catch (err) {
      setScanMsg("Scan failed: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[["New Alerts", cases.filter((c) => c.status === "New").length, C.error, C.errorSoft], ["Under Review", cases.filter((c) => c.status === "Under Review").length, C.primary, C.primarySoft], ["Actioned", cases.filter((c) => c.status === "Actioned").length, C.success, C.successSoft], ["Dismissed", cases.filter((c) => c.status === "Dismissed").length, C.sub, "#F3F4F6"]].map(([k, v, tint, soft]) => (
          <div key={k} className="rf-card hoverable" style={{ padding: 18, cursor: "pointer" }} onClick={() => setFilter(k === "New Alerts" ? "New" : k)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: C.sub }}>{k}</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldAlert size={15} /></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: tint, marginTop: 8 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rf-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <FilterChips items={["All", "New", "Under Review", "Actioned", "Dismissed"]} active={filter} onSelect={setFilter} />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {scanMsg && <span style={{ fontSize: 12, color: C.sub }}>{scanMsg}</span>}
          <button className="rf-btn ghost" onClick={runScan} disabled={scanning}><Search size={14} /> {scanning ? "Scanning…" : "Scan Now"}</button>
          <button className="rf-btn primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Case</button>
        </div>
      </div>
      <div style={{ marginTop: -14, fontSize: 11.5, color: C.sub }}>
        "Scan Now" checks real gift-entry activity against the velocity limit set in Settings → Fraud Detection Rules. Everything else here is logged manually.
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {rows.length === 0 && <div className="rf-card" style={{ padding: 30, textAlign: "center", color: C.sub, fontSize: 13.5 }}>No cases in this state.</div>}
        {rows.map((c) => {
          const u = users.find((x) => x.id === c.userId);
          const expanded = openId === c.id;
          return (
            <div key={c.id} className="rf-card" style={{ overflow: "hidden", borderLeft: `4px solid ${sevTone[c.severity][0]}` }}>
              <button style={{ width: "100%", border: "none", background: "none", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }} onClick={() => setOpenId(expanded ? null : c.id)}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: sevTone[c.severity][1], color: sevTone[c.severity][0], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AlertTriangle size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.primary }}>{c.id}</span> {c.type}
                    <Chip text={c.severity} tone={sevTone[c.severity]} />
                  </div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{u ? u.name : "Unknown user"} · Detected {c.detected}</div>
                </div>
                <Chip text={c.status} />
                <ChevIcon size={16} style={{ color: C.sub, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
              </button>

              {expanded && u && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: 20, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
                  <div style={{ background: C.bg, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.name} size={44} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: C.sub }}>{u.city}</div>
                      </div>
                      <div style={{ marginLeft: "auto" }}><Chip text={u.status} /></div>
                    </div>
                    {[["Mobile", u.mobile], ["Email", u.email], ["Package", u.pkg], ["Registered", u.reg], ["Events / Gifts", `${u.events} / ${u.gifts}`], ["Last active", u.last]].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #E9EDF3", fontSize: 12.5 }}>
                        <span style={{ color: C.sub }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <button className="rf-btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={() => openUser(u.id)}><Eye size={14} /> Open full profile</button>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: ".05em" }}>Evidence</div>
                    <p style={{ fontSize: 13.5, margin: "8px 0 0", lineHeight: 1.55 }}>{c.evidence}</p>
                    <div style={{ marginTop: 12, padding: 12, background: C.warningSoft, borderRadius: 12, fontSize: 12.5, color: "#92600A", display: "flex", gap: 8 }}>
                      <Sparkles size={15} style={{ flexShrink: 0, marginTop: 1 }} /> Signal: {c.signal}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                      {u.status !== "Suspended" && c.status !== "Actioned" && (
                        <button className="rf-btn danger" onClick={() => { onSuspend(u.id, u.status); onSetStatus(c.rawId, "Actioned"); }}><Ban size={14} /> Suspend user & close case</button>
                      )}
                      {c.status === "New" && <button className="rf-btn ghost" onClick={() => onSetStatus(c.rawId, "Under Review")}><Eye size={14} /> Mark under review</button>}
                      {c.status !== "Dismissed" && c.status !== "Actioned" && <button className="rf-btn ghost" onClick={() => onSetStatus(c.rawId, "Dismissed")}>Dismiss — legitimate</button>}
                      {(c.status === "Dismissed" || c.status === "Actioned") && <button className="rf-btn ghost" onClick={() => onSetStatus(c.rawId, "Under Review")}><RefreshCw size={14} /> Reopen case</button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && (
        <Modal title="Log Fraud/Spam Case" close={() => setShowNew(false)}>
          <Field label="User *">
            <UserSearchSelect users={users} value={form.userId} onChange={(userId) => setForm({ ...form, userId })} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Type">
              <select className="rf-input plain" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {CASE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select className="rf-input plain" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {["Low", "Medium", "High"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Evidence">
            <textarea className="rf-input plain" rows={3} style={{ resize: "vertical" }} placeholder="What did you observe?" value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
          </Field>
          <Field label="Signal (optional)">
            <input className="rf-input plain" placeholder="e.g. 12 identical entries in 3 minutes" value={form.signal} onChange={(e) => setForm({ ...form, signal: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={!form.userId} onClick={createCase}><Plus size={14} /> Log case</button>
            <button className="rf-btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
