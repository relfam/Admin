import React, { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, Crown, Lock, ShieldAlert, Bell, Palette, HardDrive, Code2,
  Trash2, Plus, RefreshCw, CheckCircle2, ChevronLeft,
} from "lucide-react";
import { C } from "../theme";
import { Toggle } from "../components/shared";
import { formatDateTime } from "../api";

const SettingRow = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0", borderBottom: "1px solid #F1F3F6" }}>
    <div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{children}</div>
  </div>
);

const DEFAULTS = {
  general: { appName: "Relfam", region: "India (Mumbai)", lang: "Tamil", currency: "INR (₹)" },
  packages: { pro: 199, adv: 499, trial: 7, grace: "3 days" },
  security: { tfa: true, timeout: "30 min", ips: [] },
  fraudRules: { velocity: 20, score: 0.85, autoSuspend: false, dupQr: true },
  notifSettings: { otp: "MSG91", budget: 4000, sender: "hello@relfam.app" },
  theme: { brand: "#5B8DEF", dark: false },
  backup: { last: "Never", auto: true, freq: "Daily" },
  api: { key: "—", hooks: [], rate: "600 req/min" },
};

export default function SettingsScreen({ settings, onSave, onSavePackages, onRunBackup }) {
  const [section, setSection] = useState(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState(DEFAULTS);
  const [newIp, setNewIp] = useState("");
  const [newHook, setNewHook] = useState("");
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    setState((prev) => {
      const merged = { ...prev };
      for (const key of Object.keys(DEFAULTS)) merged[key] = { ...DEFAULTS[key], ...(settings[key] || {}) };
      return merged;
    });
  }, [settings]);

  const set = (key, patch) => setState({ ...state, [key]: { ...state[key], ...patch } });

  // Actually runs pg_dump server-side (see /api/admin/backup/run) rather than the old fake local
  // `set("backup", { last: "Just now" })` — settings reload afterward pulls back the real
  // timestamp/file/size the backup route just persisted, so this button reflects what actually
  // happened instead of an optimistic label.
  const runBackupNow = async () => {
    setBackupError("");
    setRunningBackup(true);
    try {
      await onRunBackup();
    } catch (err) {
      setBackupError(err.message || "Backup failed");
    } finally {
      setRunningBackup(false);
    }
  };

  const save = async (key) => {
    await onSave(key, state[key]);
    if (key === "packages") await onSavePackages(state.packages);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const CARDS = [
    ["general", "General Settings", "App name, region, default language, currency", SettingsIcon, C.primary, C.primarySoft],
    ["packages", "Package Settings", "Pro / Advanced pricing, trial rules, grace period", Crown, C.gold, C.goldSoft],
    ["security", "Security", "2FA for admins, session timeout, IP allowlist", Lock, C.error, C.errorSoft],
    ["fraudRules", "Fraud Detection Rules", "Velocity limits, content filter thresholds", ShieldAlert, C.warning, C.warningSoft],
    ["notifSettings", "Notification Settings", "OTP provider, SMS budget caps, email sender", Bell, "#E48BA5", "#FDF1F4"],
    ["theme", "Theme", "Brand colors", Palette, "#8B5CF6", "#F3EFFE"],
    ["backup", "Backup", "Database snapshot bookkeeping", HardDrive, C.success, C.successSoft],
    ["api", "API Configuration", "Webhooks, keys, rate limits", Code2, C.sub, "#F3F4F6"],
  ];

  if (!section) return (
    <div className="rf-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {CARDS.map(([id, t, sub, Icon, tint, soft]) => (
        <div key={id} className="rf-card hoverable" style={{ padding: 20, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }} onClick={() => setSection(id)}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={19} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const card = CARDS.find((c) => c[0] === section);
  const Sel = ({ value, onChange, opts, width = 170 }) => (
    <select className="rf-input plain" style={{ width, padding: "8px 12px" }} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  );
  const Num = ({ value, onChange, width = 110, step }) => (
    <input type="number" step={step} className="rf-input plain" style={{ width, padding: "8px 12px" }} value={value} onChange={(e) => onChange(e.target.value)} />
  );

  const s = state[section];

  return (
    <div className="rf-fade">
      <button className="rf-btn ghost" style={{ width: "fit-content", marginBottom: 16 }} onClick={() => setSection(null)}><ChevronLeft size={14} /> Back to Settings</button>
      <div className="rf-card" style={{ padding: 24, maxWidth: 680 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: card[5], color: card[4], display: "flex", alignItems: "center", justifyContent: "center" }}>{React.createElement(card[3], { size: 18 })}</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{card[1]}</div>
        </div>

        {section === "general" && <>
          <SettingRow label="App name"><input className="rf-input plain" style={{ width: 200, padding: "8px 12px" }} value={s.appName} onChange={(e) => set("general", { appName: e.target.value })} /></SettingRow>
          <SettingRow label="Data region"><Sel value={s.region} onChange={(v) => set("general", { region: v })} opts={["India (Mumbai)", "Singapore", "US East"]} /></SettingRow>
          <SettingRow label="Default language"><Sel value={s.lang} onChange={(v) => set("general", { lang: v })} opts={["Tamil", "English", "Telugu", "Kannada", "Malayalam", "Hindi"]} /></SettingRow>
          <SettingRow label="Currency"><Sel value={s.currency} onChange={(v) => set("general", { currency: v })} opts={["INR (₹)", "SGD (S$)", "USD ($)"]} /></SettingRow>
        </>}

        {section === "packages" && <>
          <SettingRow label="Regular price"><span style={{ fontSize: 13, color: C.sub }}>₹0 — free forever</span></SettingRow>
          <SettingRow label="Pro price (₹/month)"><Num value={s.pro} onChange={(v) => set("packages", { pro: v })} /></SettingRow>
          <SettingRow label="Advanced price (₹/month)"><Num value={s.adv} onChange={(v) => set("packages", { adv: v })} /></SettingRow>
          <SettingRow label="Free trial (days)"><Num value={s.trial} onChange={(v) => set("packages", { trial: v })} /></SettingRow>
          <SettingRow label="Grace period after failed payment"><Sel value={s.grace} onChange={(v) => set("packages", { grace: v })} opts={["No grace", "3 days", "7 days", "14 days"]} /></SettingRow>
        </>}

        {section === "security" && <>
          <SettingRow label="Require 2FA for all admins"><Toggle on={s.tfa} onClick={() => set("security", { tfa: !s.tfa })} /></SettingRow>
          <SettingRow label="Session timeout"><Sel value={s.timeout} onChange={(v) => set("security", { timeout: v })} opts={["15 min", "30 min", "1 hour", "8 hours"]} /></SettingRow>
          <div style={{ padding: "13px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Admin IP allowlist</div>
            {s.ips.map((ip) => (
              <div key={ip} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F8FAFC", borderRadius: 10, marginBottom: 8, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>
                {ip}
                <button className="rf-icon-btn" style={{ width: 28, height: 28, color: C.error, border: "none", background: "none" }} onClick={() => set("security", { ips: s.ips.filter((x) => x !== ip) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input className="rf-input plain" placeholder="Add IP address…" style={{ padding: "8px 12px" }} value={newIp} onChange={(e) => setNewIp(e.target.value)} />
              <button className="rf-btn ghost" disabled={!newIp.trim()} onClick={() => { set("security", { ips: [...s.ips, newIp.trim()] }); setNewIp(""); }}><Plus size={14} /> Add</button>
            </div>
          </div>
        </>}

        {section === "fraudRules" && <>
          <SettingRow label="Max gift entries per minute"><Num value={s.velocity} onChange={(v) => set("fraudRules", { velocity: v })} /></SettingRow>
          <SettingRow label="Content filter flag threshold (0–1)"><Num value={s.score} step="0.05" onChange={(v) => set("fraudRules", { score: v })} /></SettingRow>
          <SettingRow label="Auto-suspend on High severity"><Toggle on={s.autoSuspend} onClick={() => set("fraudRules", { autoSuspend: !s.autoSuspend })} /></SettingRow>
          <SettingRow label="Flag duplicate QR scans"><Toggle on={s.dupQr} onClick={() => set("fraudRules", { dupQr: !s.dupQr })} /></SettingRow>
        </>}

        {section === "notifSettings" && <>
          <SettingRow label="OTP / SMS provider"><Sel value={s.otp} onChange={(v) => set("notifSettings", { otp: v })} opts={["MSG91", "Twilio", "AWS SNS", "Kaleyra"]} /></SettingRow>
          <SettingRow label="Monthly SMS budget (₹)"><Num value={s.budget} onChange={(v) => set("notifSettings", { budget: v })} /></SettingRow>
          <SettingRow label="Email sender"><input className="rf-input plain" style={{ width: 220, padding: "8px 12px" }} value={s.sender} onChange={(e) => set("notifSettings", { sender: e.target.value })} /></SettingRow>
        </>}

        {section === "theme" && <>
          <div style={{ padding: "13px 0", borderBottom: "1px solid #F1F3F6" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Brand color</div>
            <div style={{ display: "flex", gap: 10 }}>
              {["#5B8DEF", "#D4AF37", "#F6B8C8", "#1e2a5e", "#22C55E"].map((c) => (
                <button key={c} onClick={() => set("theme", { brand: c })} style={{ width: 36, height: 36, borderRadius: "50%", background: c, cursor: "pointer", border: s.brand === c ? "3px solid " + C.text : "3px solid transparent" }} title={c} />
              ))}
            </div>
          </div>
          <SettingRow label="Selected"><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, fontWeight: 700, color: s.brand }}>{s.brand}</span></SettingRow>
          <SettingRow label="Dark mode (beta)"><Toggle on={s.dark} onClick={() => set("theme", { dark: !s.dark })} /></SettingRow>
        </>}

        {section === "backup" && <>
          <SettingRow label="Last backup"><span style={{ fontSize: 13, color: C.sub }}>{formatDateTime(s.last) === "—" ? "Never" : formatDateTime(s.last)}</span></SettingRow>
          {s.lastFile && (
            <SettingRow label="Last backup file">
              <span style={{ fontSize: 12, color: C.sub, fontFamily: "ui-monospace, monospace" }}>
                {s.lastFile}{s.lastSizeBytes ? ` · ${(s.lastSizeBytes / 1024).toFixed(0)} KB` : ""}{s.lastTrigger === "auto" ? " · auto" : ""}
              </span>
            </SettingRow>
          )}
          <SettingRow label="Auto backup"><Toggle on={s.auto} onClick={() => set("backup", { auto: !s.auto })} /></SettingRow>
          <SettingRow label="Frequency"><Sel value={s.freq} onChange={(v) => set("backup", { freq: v })} opts={["Hourly", "Daily", "Weekly"]} /></SettingRow>
          <div style={{ paddingTop: 14 }}>
            <button className="rf-btn primary" disabled={runningBackup} onClick={runBackupNow}>
              <RefreshCw size={14} className={runningBackup ? "rf-spin" : undefined} /> {runningBackup ? "Backing up…" : "Mark backed up now"}
            </button>
            {backupError && <div style={{ marginTop: 8, fontSize: 12, color: C.error }}>{backupError}</div>}
          </div>
        </>}

        {section === "api" && <>
          <SettingRow label="Rate limit"><Sel value={s.rate} onChange={(v) => set("api", { rate: v })} opts={["300 req/min", "600 req/min", "1200 req/min"]} /></SettingRow>
          <div style={{ padding: "13px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Webhooks</div>
            {s.hooks.map((h) => (
              <div key={h} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#F8FAFC", borderRadius: 10, marginBottom: 8, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                {h}
                <button className="rf-icon-btn" style={{ width: 28, height: 28, color: C.error, border: "none", background: "none" }} onClick={() => set("api", { hooks: s.hooks.filter((x) => x !== h) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <input className="rf-input plain" placeholder="https://…" style={{ padding: "8px 12px" }} value={newHook} onChange={(e) => setNewHook(e.target.value)} />
              <button className="rf-btn ghost" disabled={!newHook.trim()} onClick={() => { set("api", { hooks: [...s.hooks, newHook.trim()] }); setNewHook(""); }}><Plus size={14} /> Add</button>
            </div>
          </div>
        </>}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button className="rf-btn primary" onClick={() => save(section)}><CheckCircle2 size={14} /> Save changes</button>
          {saved && <span className="rf-fade" style={{ fontSize: 12.5, color: C.success, fontWeight: 700 }}>Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
