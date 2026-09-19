import React, { useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { C } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips, Field, Modal } from "../components/shared";

export default function SupportScreen({ tickets, users, admins, onCreate, onReassign, onResolve }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ userId: "", cat: "Payments", priority: "Medium", assignedAdminId: "", desc: "" });

  const rows = tickets.filter((t) => {
    const mq = !q || (t.id + " " + t.user + " " + t.cat).toLowerCase().includes(q.toLowerCase());
    const mf = filter === "All" || t.status === filter || (filter === "High priority" && t.priority === "High");
    return mq && mf;
  });

  const createTicket = async () => {
    if (!form.userId || !form.assignedAdminId) return;
    await onCreate({ userId: Number(form.userId), category: form.cat, priority: form.priority, assignedAdminId: Number(form.assignedAdminId), description: form.desc });
    setForm({ userId: "", cat: "Payments", priority: "Medium", assignedAdminId: "", desc: "" });
    setShowNew(false);
  };

  return (
    <div className="rf-fade">
      <TableCard
        columns={["Ticket", "User", "Category", "Priority", "Assigned To", "Status", "Created", "Actions"]}
        rows={rows}
        empty="No tickets yet."
        controls={<>
          <SearchBox placeholder="Search tickets…" value={q} onChange={setQ} />
          <FilterChips items={["All", "Open", "In Progress", "Resolved", "High priority"]} active={filter} onSelect={setFilter} />
          <div style={{ marginLeft: "auto" }}><button className="rf-btn primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Ticket</button></div>
        </>}
        footer={`Showing ${rows.length} of ${tickets.length} tickets`}
        renderRow={(t) => (
          <tr key={t.id}>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, color: C.primary }}>{t.id}</td>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={t.user} size={26} /><div style={{ fontWeight: 600 }}>{t.user}</div></div></td>
            <td>{t.cat}</td>
            <td><Chip text={t.priority} /></td>
            <td>
              <select className="rf-input plain" style={{ width: 175, padding: "7px 10px", fontSize: 12.5 }} value={admins.find((m) => t.assigned.startsWith(m.name))?.id || ""} onChange={(e) => onReassign(t.rawId, Number(e.target.value))}>
                <option value="" disabled>Unassigned</option>
                {admins.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </td>
            <td><Chip text={t.status} /></td>
            <td style={{ color: C.sub }}>{t.created}</td>
            <td>{t.status !== "Resolved" && <button className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onResolve(t.rawId)}><CheckCircle2 size={13} /> Resolve</button>}</td>
          </tr>
        )}
      />

      {showNew && (
        <Modal title="Create Support Ticket" close={() => setShowNew(false)}>
          <Field label="User *">
            <select className="rf-input plain" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Select user…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.uid} — {u.name} · {u.city}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Category">
              <select className="rf-input plain" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                {["Payments", "QR Collection", "OTP / Login", "Family Sharing", "Gift Records", "Billing / Packages", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="rf-input plain" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["Low", "Medium", "High"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Assign to *">
            <select className="rf-input plain" value={form.assignedAdminId} onChange={(e) => setForm({ ...form, assignedAdminId: e.target.value })}>
              <option value="">Select team member…</option>
              {admins.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea className="rf-input plain" rows={3} style={{ resize: "vertical" }} placeholder="What's the issue?" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={!form.userId || !form.assignedAdminId} onClick={createTicket}><Plus size={14} /> Create & assign</button>
            <button className="rf-btn ghost" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
