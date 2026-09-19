import React, { useState } from "react";
import { FolderOpen, Palette, HelpCircle, Megaphone, FileText, Globe, ChevronLeft, ChevronRight as ChevIcon, Plus, Trash2, Pencil } from "lucide-react";
import { C, ONBOARDING_ITEMS, THEME_ITEMS, TRANSLATIONS, LEGAL_ITEMS } from "../theme";
import { SectionCard, Chip, Toggle } from "../components/shared";

export default function ContentScreen({ faq, announces, onAddFaq, onToggleFaq, onDeleteFaq, onAddAnnouncement, onToggleAnnouncement, onDeleteAnnouncement }) {
  const [section, setSection] = useState(null);
  const [newAnn, setNewAnn] = useState("");
  const [newFaq, setNewFaq] = useState("");

  const cards = [
    { key: "onboarding", t: "Onboarding Screens", s: `${ONBOARDING_ITEMS.length} screens · reference copy`, Icon: FolderOpen, tint: C.primary, soft: C.primarySoft },
    { key: "themes", t: "Event Type Themes", s: `${THEME_ITEMS.length} themes`, Icon: Palette, tint: C.gold, soft: C.goldSoft },
    { key: "faq", t: "FAQ & Help Articles", s: `${faq.length} articles · ${faq.filter((f) => !f.published).length} in draft`, Icon: HelpCircle, tint: C.success, soft: C.successSoft },
    { key: "announcements", t: "App Announcements", s: `${announces.filter((a) => a.active).length} active banners`, Icon: Megaphone, tint: "#E48BA5", soft: "#FDF1F4" },
    { key: "legal", t: "Legal & Policies", s: "Terms, Privacy, Refunds", Icon: FileText, tint: "#8B5CF6", soft: "#F3EFFE" },
    { key: "translations", t: "Translations", s: "Tamil 100% · Telugu 68%", Icon: Globe, tint: C.warning, soft: C.warningSoft },
  ];

  if (!section) {
    return (
      <div className="rf-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {cards.map(({ key, t, s, Icon, tint, soft }) => (
          <button key={key} className="rf-card hoverable" style={{ padding: 20, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }} onClick={() => setSection(key)}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: soft, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} /></div>
            <div style={{ fontWeight: 700, marginTop: 14, fontSize: 14.5, color: C.text }}>{t}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>{s}</div>
            <div style={{ fontSize: 12, color: tint, fontWeight: 600, marginTop: 12, display: "flex", alignItems: "center", gap: 4 }}>Open <ChevIcon size={13} /></div>
          </button>
        ))}
      </div>
    );
  }

  const Back = () => <button className="rf-btn ghost" style={{ width: "fit-content", marginBottom: 16 }} onClick={() => setSection(null)}><ChevronLeft size={14} /> Back to Content</button>;

  if (section === "faq") {
    const addFaq = () => { if (!newFaq.trim()) return; onAddFaq({ title: newFaq.trim(), category: "General" }); setNewFaq(""); };
    return (
      <div className="rf-fade">
        <Back />
        <SectionCard title="FAQ & Help Articles" action={<span style={{ fontSize: 12, color: C.sub }}>{faq.filter((f) => f.published).length} published · {faq.filter((f) => !f.published).length} draft</span>}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="rf-input plain" placeholder="New article title…" value={newFaq} onChange={(e) => setNewFaq(e.target.value)} />
            <button className="rf-btn primary" onClick={addFaq} disabled={!newFaq.trim()}><Plus size={14} /> Add draft</button>
          </div>
          {faq.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>No articles yet.</div>}
          {faq.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{f.title}</div>
                <div style={{ fontSize: 11.5, color: C.sub }}>{f.category}</div>
              </div>
              <Chip text={f.published ? "Published" : "Draft"} />
              <Toggle on={f.published} onClick={() => onToggleFaq(f.id)} />
              <button className="rf-icon-btn" style={{ width: 30, height: 30, border: "none", color: C.error }} title="Delete article" onClick={() => onDeleteFaq(f.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </SectionCard>
      </div>
    );
  }

  if (section === "announcements") {
    const addAnn = () => { if (!newAnn.trim()) return; onAddAnnouncement({ title: newAnn.trim(), placement: "Home banner" }); setNewAnn(""); };
    return (
      <div className="rf-fade">
        <Back />
        <SectionCard title="App Announcements" action={<span style={{ fontSize: 12, color: C.sub }}>{announces.filter((a) => a.active).length} live in app</span>}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="rf-input plain" placeholder="New announcement text…" value={newAnn} onChange={(e) => setNewAnn(e.target.value)} />
            <button className="rf-btn primary" onClick={addAnn} disabled={!newAnn.trim()}><Megaphone size={14} /> Publish</button>
          </div>
          {announces.length === 0 && <div style={{ fontSize: 13, color: C.sub }}>No announcements yet.</div>}
          {announces.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13.5 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: "#FDF1F4", color: "#E48BA5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Megaphone size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: C.sub }}>{a.placement}</div>
              </div>
              <Chip text={a.active ? "Live" : "Off"} tone={a.active ? [C.success, C.successSoft] : [C.sub, "#F3F4F6"]} />
              <Toggle on={a.active} onClick={() => onToggleAnnouncement(a.id)} />
              <button className="rf-icon-btn" style={{ width: 30, height: 30, border: "none", color: C.error }} title="Delete" onClick={() => onDeleteAnnouncement(a.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </SectionCard>
      </div>
    );
  }

  if (section === "translations") {
    return (
      <div className="rf-fade">
        <Back />
        <SectionCard title="Translations">
          <div style={{ display: "grid", gap: 12 }}>
            {TRANSLATIONS.map((t) => (
              <div key={t.lang}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{t.lang}</span><span style={{ color: t.pct === 100 ? C.success : C.sub, fontWeight: 700 }}>{t.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: "#F1F3F6" }}><div style={{ width: `${t.pct}%`, height: "100%", borderRadius: 6, background: t.pct === 100 ? C.success : `linear-gradient(90deg, ${C.primary}, ${C.gold})` }} /></div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  const listMap = { onboarding: ONBOARDING_ITEMS, themes: THEME_ITEMS, legal: LEGAL_ITEMS };
  const titleMap = { onboarding: "Onboarding Screens", themes: "Event Type Themes", legal: "Legal & Policies" };
  return (
    <div className="rf-fade">
      <Back />
      <SectionCard title={titleMap[section]}>
        {listMap[section].map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13.5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{it.title}</div>
              <div style={{ fontSize: 11.5, color: C.sub }}>{it.note}</div>
            </div>
            <button className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12 }}><Pencil size={13} /> Edit</button>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
