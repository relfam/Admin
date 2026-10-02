import React, { useMemo, useRef, useState } from "react";
import { Megaphone, Clock, FileText, BarChart3, Plus, Send, Trash2, ImagePlus, X, Link2, ChevronLeft, ChevronRight, Film } from "lucide-react";
import { C, AD_EVENT_TYPES } from "../theme";
import { Chip, Toggle, Field, Modal } from "../components/shared";
import LocationTargetFields from "../components/LocationTarget";
import UserMultiSelect from "../components/UserMultiSelect";
import { api, adMediaUrl } from "../api";

// Several images and videos per ad — shown in the app as a strip people swipe through. Files are uploaded to the server
// one by one as they're picked (adMedia.js there checks type and size again).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_MEDIA = 10;

function MediaThumb({ item, size = 96 }) {
  const src = adMediaUrl(item.path);
  const box = { width: size, height: Math.round(size * 9 / 16), borderRadius: 10, objectFit: "cover", border: `1px solid ${C.border}`, background: "#0b0b0f", display: "block" };
  if (item.type === "video") return <video src={src} muted playsInline preload="metadata" style={box} />;
  return <img src={src} alt="" style={box} />;
}

export default function AdsScreen({ ads, events, users, onPublish, onToggle, onDelete }) {
  const [showNew, setShowNew] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [uploading, setUploading] = useState(0);
  const fileInputRef = useRef(null);
  const blank = { title: "", body: "", evType: "All types", targetUserIds: [], placement: "Event page banner", media: [], linkUrl: "", maxPerDayChoice: "All day", maxPerDayCustom: "", customFrom: "", customTo: "", targetStates: [], targetDistricts: [] };
  const [form, setForm] = useState(blank);

  const onPickMedia = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setMediaError("");
    const room = MAX_MEDIA - form.media.length;
    if (room <= 0) { setMediaError(`An ad can have up to ${MAX_MEDIA} images and videos.`); return; }
    const problems = [];
    const ok = files.slice(0, room).filter((f) => {
      const isVideo = f.type.startsWith("video/"), isImage = f.type.startsWith("image/");
      if (!isVideo && !isImage) { problems.push(`${f.name}: not an image or video`); return false; }
      if (isImage && f.size > MAX_IMAGE_BYTES) { problems.push(`${f.name}: images must be under 5 MB`); return false; }
      if (isVideo && f.size > MAX_VIDEO_BYTES) { problems.push(`${f.name}: videos must be under 30 MB`); return false; }
      return true;
    });
    if (files.length > room) problems.push(`Only ${room} more can be added (up to ${MAX_MEDIA} per ad).`);
    for (const f of ok) {
      setUploading((n) => n + 1);
      try {
        const saved = await api.uploadAdMedia(f);
        setForm((cur) => ({ ...cur, media: [...cur.media, { type: saved.type, path: saved.path }] }));
      } catch (err) {
        problems.push(`${f.name}: ${err.message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (problems.length) setMediaError(problems.join(" · "));
  };
  const moveMedia = (i, dir) => setForm((f) => {
    const m = [...f.media]; const j = i + dir;
    if (j < 0 || j >= m.length) return f;
    [m[i], m[j]] = [m[j], m[i]];
    return { ...f, media: m };
  });
  const removeMedia = (i) => setForm((f) => ({ ...f, media: f.media.filter((_, k) => k !== i) }));

  const reach = useMemo(() => events.filter((e) => {
    const mt = form.evType === "All types" || e.type === form.evType;
    const mu = !form.targetUserIds.length || form.targetUserIds.map(String).includes(String(e.hostId));
    return mt && mu;
  }), [form, events]);

  const publish = async (status) => {
    if (!form.title.trim()) return;
    const isCustom = form.maxPerDayChoice === "Custom";
    const maxPerDay = form.maxPerDayChoice === "All day" ? null
      : isCustom ? (Number(form.maxPerDayCustom) || null)
      : Number(form.maxPerDayChoice);
    const dateMode = isCustom && (form.customFrom || form.customTo) ? "Custom" : "All dates";
    await onPublish({
      title: form.title, body: form.body, eventType: form.evType,
      targetUserIds: form.targetUserIds.length ? form.targetUserIds : null,
      placement: form.placement, media: form.media, linkUrl: form.linkUrl, maxPerDay, status,
      dateMode, from: isCustom ? (form.customFrom || null) : null, to: isCustom ? (form.customTo || null) : null,
      targetStates: form.targetStates.length ? form.targetStates : null,
      targetDistricts: form.targetDistricts.length ? form.targetDistricts : null,
    });
    setForm(blank);
    setShowNew(false);
  };

  const showPerDayLabel = (a) => a.maxPerDay ? `Shown ${a.maxPerDay}x/day` : "All day";
  const dateRangeLabel = (a) => a.dateMode === "Custom" && (a.from || a.to) ? `${a.from || "…"} – ${a.to || "…"}` : null;
  const locationLabel = (a) => {
    if (!a.targetStates?.length) return null;
    const states = a.targetStates.length > 2 ? `${a.targetStates.length} states` : a.targetStates.join(", ");
    const districts = a.targetDistricts?.length ? ` (${a.targetDistricts.length > 2 ? a.targetDistricts.length + " districts" : a.targetDistricts.join(", ")})` : "";
    return states + districts;
  };
  const live = ads.filter((a) => a.status === "Live").length;

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[["Live ads", live, C.success, C.successSoft, Megaphone], ["Paused", ads.filter((a) => a.status === "Paused").length, C.warning, C.warningSoft, Clock], ["Drafts", ads.filter((a) => a.status === "Draft").length, C.sub, "#F3F4F6", FileText], ["Total campaigns", ads.length, C.primary, C.primarySoft, BarChart3]].map(([k, v, tint, soft, Icon]) => (
          <div key={k} className="rf-card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} /></div>
            <div><div style={{ fontSize: 12, color: C.sub }}>{k}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div></div>
          </div>
        ))}
      </div>

      <div className="rf-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ad campaigns</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Publish ads to all event types, or target by event type and user, with a daily dismiss cap.</div>
          </div>
          <button className="rf-btn primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Advertisement</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {ads.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.sub, fontSize: 13 }}>No ad campaigns yet.</div>}
          {ads.map((a) => (
            <div key={a.id} className="rf-card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start", borderRadius: 14 }}>
              {a.media?.length ? (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <MediaThumb item={a.media[0]} size={64} />
                  {a.media.length > 1 && <span style={{ position: "absolute", right: 3, bottom: 3, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "1px 5px" }}>+{a.media.length - 1}</span>}
                </div>
              ) : a.image ? (
                <img src={a.image} alt="" style={{ width: 64, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}` }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 12, background: a.status === "Live" ? C.successSoft : a.status === "Paused" ? C.warningSoft : "#F3F4F6", color: a.status === "Live" ? C.success : a.status === "Paused" ? C.warning : C.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Megaphone size={17} /></div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: C.sub }}>{a.id}</span>
                  <Chip text={a.status} tone={a.status === "Live" ? [C.success, C.successSoft] : a.status === "Paused" ? [C.warning, C.warningSoft] : [C.sub, "#F3F4F6"]} />
                </div>
                {a.body && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{a.body}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Chip text={a.evType} tone={[C.primary, C.primarySoft]} />
                  <Chip text={a.user} tone={[C.gold, C.goldSoft]} />
                  <Chip text={showPerDayLabel(a)} tone={["#8B5CF6", "#F3EFFE"]} />
                  {dateRangeLabel(a) && <Chip text={dateRangeLabel(a)} tone={["#8B5CF6", "#F3EFFE"]} />}
                  {locationLabel(a) && <Chip text={locationLabel(a)} tone={[C.success, C.successSoft]} />}
                  <Chip text={a.placement} tone={[C.sub, "#F3F4F6"]} />
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.primary, textDecoration: "none" }}>
                      <Link2 size={12} /> {a.link.length > 32 ? a.link.slice(0, 32) + "…" : a.link}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {a.status !== "Draft" && <Toggle on={a.status === "Live"} onClick={() => onToggle(a.rawId, a.status === "Live" ? "Paused" : "Live")} />}
                {a.status === "Draft" && <button className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onToggle(a.rawId, "Live")}><Send size={13} /> Publish</button>}
                <button className="rf-icon-btn" style={{ width: 32, height: 32, color: C.error }} title="Delete" onClick={() => onDelete(a.rawId)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNew && (
        <Modal title="Publish Advertisement" close={() => setShowNew(false)} width={540}>
          <Field label="Ad title *">
            <input className="rf-input plain" placeholder="e.g. Wedding photography — 20% off" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea className="rf-input plain" rows={2} style={{ resize: "vertical" }} placeholder="Short ad copy shown to users…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Field label={`Images & videos (${form.media.length}/${MAX_MEDIA})`}>
            <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple onChange={onPickMedia} style={{ display: "none" }} />
            {form.media.length > 0 && (
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
                {form.media.map((m, i) => (
                  <div key={m.path} style={{ flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <MediaThumb item={m} size={120} />
                      {m.type === "video" && <span style={{ position: "absolute", left: 6, top: 6, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "1px 5px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3, pointerEvents: "none" }}><Film size={10} /> Video</span>}
                      <span style={{ position: "absolute", left: 6, bottom: 6, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700, pointerEvents: "none" }}>{i + 1}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <button type="button" className="rf-icon-btn" style={{ width: 26, height: 26 }} title="Move left" disabled={i === 0} onClick={() => moveMedia(i, -1)}><ChevronLeft size={13} /></button>
                      <button type="button" className="rf-icon-btn" style={{ width: 26, height: 26, color: C.error }} title="Remove" onClick={() => removeMedia(i)}><X size={13} /></button>
                      <button type="button" className="rf-icon-btn" style={{ width: 26, height: 26 }} title="Move right" disabled={i === form.media.length - 1} onClick={() => moveMedia(i, 1)}><ChevronRight size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="rf-btn ghost" disabled={uploading > 0 || form.media.length >= MAX_MEDIA} onClick={() => fileInputRef.current?.click()}>
              <ImagePlus size={14} /> {uploading > 0 ? `Uploading ${uploading}…` : form.media.length ? "Add more" : "Add images or videos"}
            </button>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>Up to {MAX_MEDIA}. Images under 5 MB, videos (MP4, WEBM, MOV) under 30 MB. People swipe through them in the app, in this order.</div>
            {mediaError && <div style={{ fontSize: 11.5, color: C.error, marginTop: 6 }}>{mediaError}</div>}
          </Field>
          <Field label="Link URL (optional)">
            <input className="rf-input plain" placeholder="https://…" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
          </Field>
          <Field label="Target event type">
            <select className="rf-input plain" value={form.evType} onChange={(e) => setForm({ ...form, evType: e.target.value })}>
              {AD_EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <UserMultiSelect users={users} selected={form.targetUserIds} onChange={(v) => setForm((f) => ({ ...f, targetUserIds: v }))} label="Target users (optional)" />
          <LocationTargetFields
            states={form.targetStates} districts={form.targetDistricts}
            onStatesChange={(v) => setForm((f) => ({ ...f, targetStates: v }))}
            onDistrictsChange={(v) => setForm((f) => ({ ...f, targetDistricts: v }))}
          />
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: -6, marginBottom: 14 }}>
            Only reaches users whose profile State is one of the selected states (and District, if any are picked) — users with no location set won't see a location-targeted ad.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.maxPerDayChoice === "Custom" ? "1fr 1fr" : "1fr", gap: 14 }}>
            <Field label="Show per day (per user)">
              <select className="rf-input plain" value={form.maxPerDayChoice} onChange={(e) => setForm({ ...form, maxPerDayChoice: e.target.value })}>
                {["1", "2", "3", "4", "5", "All day", "Custom"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            {form.maxPerDayChoice === "Custom" && (
              <Field label="Custom limit">
                <input type="number" min="1" className="rf-input plain" style={{ padding: "8px 10px" }} placeholder="e.g. 10" value={form.maxPerDayCustom} onChange={(e) => setForm({ ...form, maxPerDayCustom: e.target.value })} />
              </Field>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: -6, marginBottom: 14 }}>
            Each time a user dismisses this ad (taps ✕) counts against this limit — once they hit it, the ad stops showing to them for the rest of that day. "All day" means no limit.
          </div>
          {form.maxPerDayChoice === "Custom" && (
            <Field label="Custom date range (optional)">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="date" className="rf-input plain" style={{ padding: "8px 10px" }} value={form.customFrom} onChange={(e) => setForm({ ...form, customFrom: e.target.value })} />
                <span style={{ color: C.sub, fontSize: 12 }}>to</span>
                <input type="date" className="rf-input plain" style={{ padding: "8px 10px" }} value={form.customTo} onChange={(e) => setForm({ ...form, customTo: e.target.value })} />
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>Leave blank to run indefinitely. Set only one side for an open-ended start/end.</div>
            </Field>
          )}
          <Field label="Placement">
            <select className="rf-input plain" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              {["Event page banner", "Home feed", "Push card"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div style={{ background: C.primarySoft, borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: C.primary, fontWeight: 600, marginBottom: 14 }}>
            Reaches {reach.length} matching event{reach.length === 1 ? "" : "s"}{reach.length > 0 ? ": " + reach.map((e) => e.name).slice(0, 3).join(", ") + (reach.length > 3 ? "…" : "") : " — widen your targeting."}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={!form.title.trim() || uploading > 0} onClick={() => publish("Live")}><Send size={14} /> Publish now</button>
            <button className="rf-btn ghost" disabled={!form.title.trim() || uploading > 0} onClick={() => publish("Draft")}>Save draft</button>
            <button className="rf-btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
