import React, { useMemo, useState } from "react";
import { Bell, Smartphone, Mail, Send, Loader2, Clock, X } from "lucide-react";
import { C } from "../theme";
import { SectionCard, Field, FilterChips, Chip } from "../components/shared";
import LocationTargetFields from "../components/LocationTarget";
import UserMultiSelect from "../components/UserMultiSelect";

const AUDIENCES = ["All users", "Active 30d", "Pro + Advanced", "Specific users"];
const SCHEDULES = ["Send now", "Today 6 PM", "Custom…"];

// Push sends for real via Firebase Cloud Messaging (see onSendPush/onSchedulePush ->
// relfam-admin/server's /api/admin/notifications/broadcast + /schedule), reusing the same push
// infrastructure and per-device tokens the mobile app's own reminder/SOS pushes use — on its own
// notification channel/sound so it doesn't sound like either of those. A "Custom…" or "Today 6 PM"
// schedule is a real future send too: the server polls its own scheduled_notifications table every
// 30s and fires anything due (see runDueScheduledNotifications in index.js). SMS and Email have no
// provider wired up yet, so those two stay local-only/queued for now.
export default function NotificationsScreen({ users, scheduled, onSendPush, onSchedule, onCancelScheduled }) {
  const [channel, setChannel] = useState("Push");
  const [audience, setAudience] = useState("All users");
  const [targetUserIds, setTargetUserIds] = useState([]);
  const [targetStates, setTargetStates] = useState([]);
  const [targetDistricts, setTargetDistricts] = useState([]);
  const [schedule, setSchedule] = useState("Send now");
  const [customAt, setCustomAt] = useState("");
  const [title, setTitle] = useState("Aadi vibes!");
  const [msg, setMsg] = useState("Functions season is here. Record every moi in seconds and never forget who gave what.");
  const [campaigns, setCampaigns] = useState([]);
  const [name, setName] = useState("Aadi Special — Record your moi");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const minCustom = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60000); // at least 5 min out
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  const nextSixPm = () => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
  };

  const targeting = () => ({
    audience,
    targetUserIds: audience === "Specific users" && targetUserIds.length ? targetUserIds : null,
    targetStates: targetStates.length ? targetStates : null,
    targetDistricts: targetDistricts.length ? targetDistricts : null,
  });

  const submit = async () => {
    setError("");
    if (audience === "Specific users" && targetUserIds.length === 0) { setError("Pick at least one user to target."); return; }

    if (channel !== "Push") {
      setCampaigns([{ n: name || "Untitled campaign", ch: channel, s: `No ${channel} provider connected yet — queued locally for ${audience}.` }, ...campaigns]);
      return;
    }

    setSending(true);
    try {
      if (schedule === "Send now") {
        const result = await onSendPush({ title, body: msg, ...targeting() });
        setCampaigns([{ n: name || "Untitled campaign", ch: channel, s: `Sent to ${result.sent} of ${result.total} devices${result.failed ? ` · ${result.failed} failed (no valid token, or app not installed)` : ""}` }, ...campaigns]);
      } else {
        const at = schedule === "Today 6 PM" ? nextSixPm() : new Date(customAt);
        if (schedule === "Custom…" && (!customAt || Number.isNaN(at.getTime()))) { setError("Pick a valid future date/time."); setSending(false); return; }
        await onSchedule({ title, body: msg, ...targeting(), scheduledAt: at.toISOString() });
        setCampaigns([{ n: name || "Untitled campaign", ch: channel, s: `Scheduled for ${at.toLocaleString()}` }, ...campaigns]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rf-fade" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" }}>
      <SectionCard title="New Campaign">
        {channel === "Push" ? (
          <div style={{ padding: "8px 12px", background: C.successSoft, borderRadius: 10, fontSize: 12, color: "#166534", marginBottom: 16 }}>
            Push sends for real via Firebase, immediately or on a real schedule — only to users whose device has notifications enabled and registered.
          </div>
        ) : (
          <div style={{ padding: "8px 12px", background: C.warningSoft, borderRadius: 10, fontSize: 12, color: "#92600A", marginBottom: 16 }}>
            No {channel} provider connected yet — this just queues locally for now.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[["Push", Bell], ["SMS", Smartphone], ["Email", Mail]].map(([c, Icon]) => (
            <button key={c} className="rf-btn" style={{ flex: 1, justifyContent: "center", background: channel === c ? C.primary : "#fff", color: channel === c ? "#fff" : C.sub, border: `1px solid ${channel === c ? C.primary : C.border}` }} onClick={() => setChannel(c)}>
              <Icon size={15} /> {c}
            </button>
          ))}
        </div>
        <Field label="Campaign name"><input className="rf-input plain" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Title"><input className="rf-input plain" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Message"><input className="rf-input plain" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>

        <Field label="Audience">
          <FilterChips items={AUDIENCES} active={audience} onSelect={setAudience} />
        </Field>
        {audience === "Specific users" && (
          <UserMultiSelect users={users} selected={targetUserIds} onChange={setTargetUserIds} />
        )}
        <LocationTargetFields
          states={targetStates} districts={targetDistricts}
          onStatesChange={setTargetStates} onDistrictsChange={setTargetDistricts}
        />

        <Field label="Schedule">
          <FilterChips items={SCHEDULES} active={schedule} onSelect={setSchedule} />
        </Field>
        {schedule === "Custom…" && (
          <Field label="Send at">
            <input type="datetime-local" className="rf-input plain" min={minCustom} value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
          </Field>
        )}

        {error && <div style={{ fontSize: 12, color: C.error, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="rf-btn primary" onClick={submit} disabled={sending || !title.trim() || !msg.trim()}>
            {sending ? <Loader2 size={14} className="rf-spin" /> : <Send size={14} />}
            {sending ? "Sending…" : schedule === "Send now" ? (channel === "Push" ? "Send now" : "Queue") : "Schedule"}
          </button>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: 20 }}>
        <SectionCard title="Preview">
          <div style={{ background: "#111827", borderRadius: 20, padding: 16 }}>
            <div style={{ background: "rgba(255,255,255,.95)", borderRadius: 14, padding: 14, display: "flex", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>R</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{title} <span style={{ color: C.sub, fontWeight: 400 }}>· now</span></div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>{msg}</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 10 }}>
            Audience: {audience === "Specific users" ? (targetUserIds.length ? `${targetUserIds.length} user(s) picked` : "no user picked") : audience}
            {targetStates.length ? ` · ${targetStates.length} state(s)${targetDistricts.length ? `, ${targetDistricts.length} district(s)` : ""}` : ""} · Channel: {channel}
          </div>
        </SectionCard>

        <SectionCard title="Scheduled Campaigns" action={<Clock size={15} style={{ color: C.sub }} />}>
          {scheduled.filter((s) => s.status === "Pending").length === 0
            ? <div style={{ fontSize: 13, color: C.sub }}>Nothing scheduled.</div>
            : scheduled.filter((s) => s.status === "Pending").map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F3F6", fontSize: 12.5, gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                  <div style={{ color: C.sub }}>{s.scheduledAt} · {s.audience}</div>
                </div>
                <button className="rf-icon-btn" style={{ width: 28, height: 28, color: C.error, flexShrink: 0 }} title="Cancel" onClick={() => onCancelScheduled(s.id)}><X size={13} /></button>
              </div>
            ))}
        </SectionCard>

        <SectionCard title="This Session's Campaigns">
          {campaigns.length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>Nothing sent yet.</div> : campaigns.map((c, i) => (
            <div key={c.n + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F3F6", fontSize: 12.5, gap: 10 }}>
              <div><div style={{ fontWeight: 600 }}>{c.n}</div><div style={{ color: C.sub }}>{c.s}</div></div>
              <Chip text={c.ch} tone={[C.primary, C.primarySoft]} />
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
