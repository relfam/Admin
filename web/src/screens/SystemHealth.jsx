import React, { useEffect, useState, useCallback } from "react";
import { Server, Database, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Play, Mail } from "lucide-react";
import { C } from "../theme";
import { api } from "../api";
import { TableCard, Chip } from "../components/shared";

// Is the server up, can the backups really be restored, and what has been going wrong? Everything here comes from the admin server's own
// watchdog and from the events the app server records (see relfam-admin/server/ops.js). Refreshes every 30 seconds.
const ago = (iso) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  if (mins < 2880) return Math.round(mins / 60) + " h ago";
  return Math.round(mins / 1440) + " days ago";
};
const bytes = (n) => (n === null || n === undefined ? "—" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB");
const duration = (sec) => (sec === null || sec === undefined ? "—" : sec < 3600 ? Math.round(sec / 60) + " min" : sec < 172800 ? (sec / 3600).toFixed(1) + " h" : Math.round(sec / 86400) + " days");
const TONE = { good: [C.success, C.successSoft], warn: [C.warning, C.warningSoft], bad: [C.error, C.errorSoft], idle: [C.sub, "#F3F4F6"] };

const Pill = ({ tone, children }) => <span className="rf-chip" style={{ color: TONE[tone][0], background: TONE[tone][1] }}>{children}</span>;
const Row = ({ label, children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
    <span style={{ color: C.sub }}>{label}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{children}</span>
  </div>
);
const Card = ({ title, icon: Icon, right, children }) => (
  <div className="rf-card" style={{ padding: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: C.primarySoft, color: C.primary, display: "grid", placeItems: "center" }}><Icon size={17} /></div>
      <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{title}</div>{right}
    </div>
    {children}
  </div>
);

function findProblems(h) {
  const b = h.backups, out = [];
  if (h.server.up === false) out.push({ level: "bad", text: "The Relfam server is not answering." });
  else if (h.server.up === null) out.push({ level: "warn", text: "Waiting for the first server check." });
  if (b.lastVerify && !b.lastVerify.ok) out.push({ level: "bad", text: "The last backup is incomplete: " + b.lastVerify.reason });
  if (!b.last) out.push({ level: "warn", text: "No backup has been made yet." });
  else {
    const every = { Hourly: 3600000, Daily: 86400000, Weekly: 604800000 }[b.freq] || 86400000;
    if (b.auto && Date.now() - new Date(b.last).getTime() > every * 2) out.push({ level: "bad", text: "The last backup is overdue (" + ago(b.last) + ")." });
  }
  if (b.last && !b.restoreTest) out.push({ level: "warn", text: "No restore test has run yet: nobody has proved a backup can be restored." });
  if (b.restoreTest && !b.restoreTest.ok) out.push({ level: "bad", text: "The last restore test FAILED: " + b.restoreTest.error });
  if (!b.offsite || !b.offsite.configured) out.push({ level: "warn", text: "Backups are only on this computer. If its disk is lost, so are the backups. Set BACKUP_COPY_DIR to a second location." });
  else if (b.offsite.ok === false) out.push({ level: "bad", text: "Copying the backup to the second location failed: " + b.offsite.error });
  if (h.alertEmail && h.alertEmail.configured && h.alertEmail.ok === false) out.push({ level: "bad", text: "Alert emails cannot reach you: " + h.alertEmail.reason + ". Use an address that can receive mail." });
  const day = Date.now() - 86400000;
  if (h.alerts.some((a) => new Date(a.at).getTime() > day && !/back up/i.test(a.subject))) out.push({ level: "warn", text: "Alerts were raised in the last 24 hours (see below)." });
  return out;
}

export default function SystemHealthScreen() {
  const [h, setH] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => api.systemHealth().then((d) => { setH(d.health); setError(""); }).catch((e) => setError(e.message || "Could not load System Health")), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const act = async (name, fn) => {
    setBusy(name); setNote("");
    try { const r = await fn(); setNote(name === "restore" ? (r.result && r.result.ok ? "Restore test passed." : "Restore test FAILED: " + ((r.result && r.result.error) || "unknown reason")) : "Backup finished and verified."); }
    catch (e) { setNote((name === "restore" ? "Restore test" : "Backup") + " problem: " + (e.message || "failed")); }
    setBusy(""); load();
  };

  const testAlert = async () => {
    setBusy("alert"); setNote("");
    try { const r = await api.sendTestAlert(); setNote(r.undeliverable ? "The email service accepted the test alert, but it CANNOT be delivered: " + r.undeliverable : r.emailed ? "Test alert sent by email — check the inbox." : "Test alert recorded here, but the email was NOT sent: " + (r.emailError || "unknown reason")); }
    catch (e) { setNote("Test alert problem: " + (e.message || "failed")); }
    setBusy(""); load();
  };

  if (error && !h) return <div className="rf-fade rf-card" style={{ padding: 30, color: C.sub }}>{error}</div>;
  if (!h) return <div className="rf-fade" style={{ padding: 30, color: C.sub }}>Loading…</div>;
  const b = h.backups, s = h.server, rt = b.restoreTest;
  const problems = findProblems(h);
  const worst = problems.some((p) => p.level === "bad") ? "bad" : problems.length ? "warn" : "good";
  const kindRows = Object.keys(h.kinds).map((k) => { const c = h.events.counts.find((x) => x.kind === k) || { h1: 0, h24: 0 }; return { kind: k, label: h.kinds[k], h1: c.h1, h24: c.h24 }; });

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div className="rf-card" style={{ padding: 18, borderLeft: `4px solid ${TONE[worst][0]}`, background: TONE[worst][1] + "88" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 15 }}>
          {worst === "good" ? <CheckCircle2 size={20} color={C.success} /> : worst === "bad" ? <XCircle size={20} color={C.error} /> : <AlertTriangle size={20} color={C.warning} />}
          {worst === "good" ? "Everything is working" : worst === "bad" ? "Needs attention now" : "Working, with things to fix"}
          <button className="rf-btn ghost" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
        {problems.length > 0 && <ul style={{ margin: "8px 0 0 28px", padding: 0, fontSize: 13, lineHeight: 1.6 }}>{problems.map((p, i) => <li key={i} style={{ color: p.level === "bad" ? C.error : C.text }}>{p.text}</li>)}</ul>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card title="Server" icon={Server} right={<Pill tone={s.up === true ? "good" : s.up === false ? "bad" : "idle"}>{s.up === true ? "Up" : s.up === false ? "DOWN" : "Checking…"}</Pill>}>
          <Row label="Last check">{ago(s.lastCheckAt)}</Row>
          <Row label="Answered in">{s.latencyMs === null ? "—" : s.latencyMs + " ms"}</Row>
          <Row label="Up since last restart">{duration(s.uptimeSec)}</Row>
          <Row label={`Uptime (last ${s.checks} checks)`}>{s.uptimePct24h === null ? "—" : s.uptimePct24h + "%"}</Row>
          {s.up === false && <Row label="Down since">{ago(s.downSince)}</Row>}
          {s.lastError && <Row label="Problem">{s.lastError}</Row>}
        </Card>

        <Card title="Backups" icon={Database} right={<Pill tone={b.lastVerify && b.lastVerify.ok ? "good" : b.lastVerify ? "bad" : "idle"}>{b.lastVerify ? (b.lastVerify.ok ? "Verified" : "Incomplete") : "None yet"}</Pill>}>
          <Row label="Last backup">{ago(b.last)} · {bytes(b.lastSizeBytes)}</Row>
          <Row label="Schedule">{b.auto ? b.freq : "Automatic backups are OFF"}</Row>
          <Row label="Kept">{b.policy.daily} daily · {b.policy.weekly} weekly · {b.policy.monthly} monthly</Row>
          <Row label="On this computer">{b.count} files · {bytes(b.totalBytes)}</Row>
          <Row label="Second location">{b.offsite && b.offsite.configured ? (b.offsite.ok === false ? <span style={{ color: C.error }}>Failed</span> : <span style={{ color: C.success }}>Copied {ago(b.offsite.at)}</span>) : <span style={{ color: C.warning }}>Not set up</span>}</Row>
          <button className="rf-btn primary" style={{ marginTop: 12 }} disabled={!!busy} onClick={() => act("backup", api.runBackup)}><Play size={13} /> {busy === "backup" ? "Backing up and testing…" : "Run backup now"}</button>
        </Card>

        <Card title="Restore test" icon={CheckCircle2} right={<Pill tone={rt ? (rt.ok ? "good" : "bad") : "idle"}>{rt ? (rt.ok ? "Passed" : "FAILED") : "Not run"}</Pill>}>
          <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>Restores the newest backup into a temporary database and compares it with the live one.</div>
          {rt ? (
            <>
              <Row label="Last test">{ago(rt.at)} · {(rt.ms / 1000).toFixed(1)} s</Row>
              <Row label="Backup tested">{rt.file}</Row>
              {Object.entries(rt.tables || {}).map(([t, v]) => (
                <Row key={t} label={t}><span style={{ color: v.restored !== null && Math.abs(v.restored - v.expected) <= Math.max(3, Math.ceil(v.expected * 0.02)) ? C.success : C.error }}>{v.restored === null ? "missing" : v.restored} restored / {v.expected} live</span></Row>
              ))}
              {rt.error && <div style={{ color: C.error, fontSize: 12.5, marginTop: 8 }}>{rt.error}</div>}
            </>
          ) : <div style={{ fontSize: 13, color: C.warning, padding: "6px 0" }}>No restore test has run yet.</div>}
          <button className="rf-btn ghost" style={{ marginTop: 12 }} disabled={!!busy} onClick={() => act("restore", api.runRestoreTest)}><Play size={13} /> {busy === "restore" ? "Restoring…" : "Run restore test now"}</button>
        </Card>
      </div>
      {note && <div className="rf-card" style={{ padding: "12px 18px", fontSize: 13, fontWeight: 600, color: /FAILED|problem/i.test(note) ? C.error : C.success }}>{note}</div>}

      <div className="rf-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Errors and failures</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {kindRows.map((r) => (
            <div key={r.kind} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.sub }}>{r.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: r.h1 > 0 && r.kind !== "push_dead" ? C.error : C.text }}>{r.h24}<span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}> in 24 h</span></div>
              <div style={{ fontSize: 12, color: C.sub }}>{r.h1} in the last hour</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rf-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Alerts</div>
          <button className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12 }} disabled={!!busy} onClick={testAlert}>{busy === "alert" ? "Sending…" : "Send test alert"}</button>
          <Pill tone={h.alertEmailConfigured ? "good" : "warn"}><Mail size={11} style={{ marginRight: 4 }} />{h.alertEmailConfigured ? "Also sent by email" : "Shown here only"}</Pill>
        </div>
        {!h.alertEmailConfigured && <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 10 }}>To get an email when the server is down or a backup fails, set ALERT_EMAIL_TO and RESEND_API_KEY on the admin server. Note that this admin server runs on the same computer: if the whole computer goes down, only an outside monitor watching the /health address can tell you.</div>}
        {h.alerts.length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>No alerts yet.</div> : h.alerts.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: i ? "1px solid #F1F3F6" : "none", fontSize: 13 }}>
            <div style={{ width: 90, color: C.sub, flexShrink: 0 }}>{ago(a.at)}</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{a.subject}</div><div style={{ color: C.sub, fontSize: 12.5 }}>{a.text}</div></div>
            {a.emailed && <Pill tone="good">emailed</Pill>}
            {!a.emailed && a.emailError && <span style={{ color: C.error, fontSize: 11.5, maxWidth: 220 }}>email not sent: {a.emailError}</span>}
          </div>
        ))}
      </div>

      <TableCard
        columns={["Time", "Kind", "Details"]}
        rows={h.events.recent}
        empty="Nothing has gone wrong recently."
        footer={`Latest ${h.events.recent.length} events (kept for 30 days)`}
        renderRow={(e) => (
          <tr key={e.id}>
            <td style={{ color: C.sub, whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
            <td><Chip text={h.kinds[e.kind] || e.kind} tone={e.kind === "push_dead" ? [C.sub, "#F3F4F6"] : [C.error, C.errorSoft]} /></td>
            <td style={{ color: C.sub, fontSize: 12.5 }}>{Object.entries(e.detail || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</td>
          </tr>
        )}
      />
    </div>
  );
}
