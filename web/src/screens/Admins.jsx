import React, { useState } from "react";
import { UserPlus, UserCog, Trash2, CheckCircle2, ShieldCheck } from "lucide-react";
import { C, MENU } from "../theme";
import { Avatar, Chip, TableCard, Field, Modal } from "../components/shared";

export default function AdminsScreen({ admins, currentAdminId, onCreate, onUpdateAccess, onToggleTfa, onRemove }) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { name: "", email: "", password: "", role: "Support", access: [], tfa: true };
  const [form, setForm] = useState(blank);
  const SCREENS = MENU.filter((m) => m.id !== "admins");

  const openNew = () => { setForm(blank); setEditId(null); setShow(true); };
  const openEdit = (a) => { setForm({ name: a.name, email: a.email, password: "", role: a.role, access: a.access === "all" ? SCREENS.map((m) => m.id) : [...a.access], tfa: a.tfa }); setEditId(a.id); setShow(true); };
  const toggleAccess = (id) => setForm({ ...form, access: form.access.includes(id) ? form.access.filter((x) => x !== id) : [...form.access, id] });

  const saveAdmin = async () => {
    if (!form.name.trim() || !form.email.trim() || form.access.length === 0) return;
    if (editId) {
      await onUpdateAccess(editId, { name: form.name, email: form.email, role: form.role, access: form.access, tfa: form.tfa });
    } else {
      if (!form.password.trim()) return;
      await onCreate({ name: form.name, email: form.email, password: form.password, role: form.role, access: form.access, tfa: form.tfa });
    }
    setShow(false);
  };
  const modLabel = (a) => a.access === "all" ? "All modules" : a.access.map((id) => MENU.find((m) => m.id === id)?.label).filter(Boolean);

  return (
    <div className="rf-fade">
      <TableCard
        columns={["Admin", "Role", "Screen Access", "2FA", "Last Active", "Actions"]}
        rows={admins}
        empty="No admins yet."
        controls={<>
          <div style={{ fontSize: 12.5, color: C.sub }}>Super Admin can add admins and grant access to specific screens only.</div>
          <div style={{ marginLeft: "auto" }}><button className="rf-btn primary" onClick={openNew}><UserPlus size={14} /> Add Admin</button></div>
        </>}
        footer={`${admins.length} admins · access is enforced per screen`}
        renderRow={(a) => (
          <tr key={a.id}>
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={a.name} />
                <div><div style={{ fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 11.5, color: C.sub }}>{a.email}</div></div>
              </div>
            </td>
            <td><Chip text={a.role} tone={a.role === "Super Admin" ? [C.gold, C.goldSoft] : [C.primary, C.primarySoft]} /></td>
            <td>
              {a.access === "all"
                ? <Chip text="All modules" tone={[C.gold, C.goldSoft]} />
                : <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxWidth: 320 }}>
                    {modLabel(a).slice(0, 4).map((m) => <Chip key={m} text={m} tone={[C.primary, C.primarySoft]} />)}
                    {a.access.length > 4 && <Chip text={"+" + (a.access.length - 4) + " more"} tone={[C.sub, "#F3F4F6"]} />}
                  </div>}
            </td>
            <td><button style={{ border: "none", background: "none", cursor: a.access === "all" ? "default" : "pointer" }} onClick={() => a.access !== "all" && onToggleTfa(a.id)}>{a.tfa ? <Chip text="Enabled" tone={[C.success, C.successSoft]} /> : <Chip text="Off" tone={[C.error, C.errorSoft]} />}</button></td>
            <td style={{ color: C.sub }}>{a.last}</td>
            <td>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="rf-icon-btn" style={{ width: 30, height: 30, border: "none" }} title="Edit access" onClick={() => openEdit(a)}><UserCog size={14} /></button>
                {a.id !== currentAdminId && <button className="rf-icon-btn" style={{ width: 30, height: 30, border: "none", color: C.error }} title="Remove admin" onClick={() => onRemove(a.id)}><Trash2 size={14} /></button>}
              </div>
            </td>
          </tr>
        )}
      />

      {show && (
        <Modal title={editId ? "Edit Admin Access" : "Add Admin"} close={() => setShow(false)} width={520}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Name *">
              <input className="rf-input plain" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email *">
              <input className="rf-input plain" placeholder="name@relfam.app" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          {!editId && (
            <Field label="Temporary password *">
              <input className="rf-input plain" type="text" placeholder="They'll use this to sign in" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Role">
              <select className="rf-input plain" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {["Support", "Support Lead", "Ops Admin", "Analyst", "Content Admin"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Require 2FA">
              <div style={{ paddingTop: 4 }}>{form.tfa ? "On" : "Off"} <button type="button" className="rf-btn ghost" style={{ padding: "4px 10px", fontSize: 11.5, marginLeft: 8 }} onClick={() => setForm({ ...form, tfa: !form.tfa })}>Toggle</button></div>
            </Field>
          </div>
          <Field label={`Screen access * (${form.access.length} of ${SCREENS.length} selected)`}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 240, overflowY: "auto", border: "1px solid " + C.border, borderRadius: 12, padding: 10 }}>
              {SCREENS.map((m) => {
                const on = form.access.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggleAccess(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600, textAlign: "left", border: "1px solid " + (on ? C.primary : C.border), background: on ? C.primarySoft : "#fff", color: on ? C.primary : C.sub }}>
                    <m.icon size={14} style={{ flexShrink: 0 }} />
                    {m.label}
                    {on && <CheckCircle2 size={13} style={{ marginLeft: "auto", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => setForm({ ...form, access: SCREENS.map((m) => m.id) })}>Select all</button>
              <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => setForm({ ...form, access: [] })}>Clear</button>
            </div>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={!form.name.trim() || !form.email.trim() || form.access.length === 0 || (!editId && !form.password.trim())} onClick={saveAdmin}>
              <ShieldCheck size={14} /> {editId ? "Save access" : "Add admin"}
            </button>
            <button className="rf-btn ghost" onClick={() => setShow(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
