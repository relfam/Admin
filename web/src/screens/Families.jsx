import React, { useState } from "react";
import { ChevronLeft, ChevronRight as ChevIcon, Home, Trash2, UserPlus } from "lucide-react";
import { C, inr } from "../theme";
import { Avatar, Chip, TableCard, SectionCard, Field, SearchBox } from "../components/shared";

const FAMILIES_PAGE_SIZE = 24;

// Fetches (and searches/pages) server-side now instead of rendering every family the app has ever
// captured in one grid — see listFamilies/countFamilies (server/db.js). `families` here is always
// just the current page's worth; `total` is the real count across all of them, from a separate
// COUNT query, not families.length.
export const FamiliesScreen = ({ families, openFamily, query, onQueryChange, page, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / FAMILIES_PAGE_SIZE));
  const start = total === 0 ? 0 : page * FAMILIES_PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * FAMILIES_PAGE_SIZE);
  return (
    <div className="rf-fade">
      <div className="rf-card" style={{ padding: "16px 20px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <SearchBox placeholder="Search family name, member name, or mobile…" width={340} value={query} onChange={onQueryChange} />
        <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 600 }}>
          {total === 0 ? "No families found" : `Showing ${start}–${end} of ${total.toLocaleString()} families`}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {families.length === 0 && <div className="rf-card" style={{ padding: 30, textAlign: "center", color: C.sub, fontSize: 13.5, gridColumn: "1 / -1" }}>{query ? `No families match "${query}".` : "No families with linked members yet."}</div>}
        {families.map((f) => (
          <div key={f.id} className="rf-card hoverable" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: C.goldSoft, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}><Home size={20} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: C.sub }}>Head: {f.head}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 8, marginTop: 16, textAlign: "center" }}>
              {[["Members", f.members.length], ["Events", f.events], ["Moi ledger", inr(f.moi)]].map(([k, v]) => (
                <div key={k} style={{ background: C.bg, borderRadius: 12, padding: "10px 6px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
            <button className="rf-btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={() => openFamily(f.id)}>Manage family <ChevIcon size={14} /></button>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 20 }}>
          <button className="rf-btn ghost" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft size={14} /> Prev</button>
          <span style={{ fontSize: 12.5, color: C.sub }}>Page {page + 1} of {totalPages}</span>
          <button className="rf-btn ghost" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next <ChevIcon size={14} /></button>
        </div>
      )}
    </div>
  );
};

export const FamilyDetail = ({ family, back, onAddMember, onRemoveMember }) => {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [mobile, setMobile] = useState("");
  const f = family;
  if (!f) return <div className="rf-fade" style={{ padding: 30, color: C.sub, fontSize: 13 }}>Loading…</div>;

  const addMember = async () => {
    if (!name.trim()) return;
    await onAddMember(f.primaryUserId, { name: name.trim(), relation: relation.trim() || "Relative", mobile: mobile.trim() });
    setName(""); setRelation(""); setMobile("");
  };

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <button className="rf-btn ghost" style={{ width: "fit-content" }} onClick={back}><ChevronLeft size={14} /> Back to Family Accounts</button>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="rf-card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: C.goldSoft, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Home size={28} /></div>
            <div style={{ marginTop: 14, fontSize: 17, fontWeight: 700 }}>{f.name}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>Head: {f.head}</div>
          </div>
          <SectionCard title="Family Ledger">
            {[["Total moi value", inr(f.moi)], ["Events hosted", f.events], ["Hide Amount", "Enforced app-wide"], ["Guest access", "Read-only (server-enforced)"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
                <span style={{ color: C.sub }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Add Member">
            <Field label="Full name"><input className="rf-input plain" placeholder="e.g. Rajalakshmi Ammal" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Mobile"><input className="rf-input plain" placeholder="e.g. 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} /></Field>
            <Field label="Relation"><input className="rf-input plain" placeholder="e.g. Aunt" value={relation} onChange={(e) => setRelation(e.target.value)} /></Field>
            <button className="rf-btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={addMember} disabled={!name.trim()}><UserPlus size={14} /> Add member</button>
          </SectionCard>
        </div>
        <TableCard
          columns={["Member", "Relation", "Actions"]}
          rows={f.members}
          empty="No family members linked yet."
          footer={`${f.members.length} members`}
          renderRow={(m) => (
            <tr key={m.id}>
              <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={m.name} /><span style={{ fontWeight: 600 }}>{m.name}</span></div></td>
              <td style={{ color: C.sub }}>{m.relation}</td>
              <td>
                <button title="Remove from family" className="rf-icon-btn" style={{ width: 30, height: 30, border: "none", color: C.error }} onClick={() => onRemoveMember(m.id)}><Trash2 size={14} /></button>
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
};
