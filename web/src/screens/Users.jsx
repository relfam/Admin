import React from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Ban, RefreshCw, CalendarDays } from "lucide-react";
import { C, inr } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips, SectionCard } from "../components/shared";

const USERS_PAGE_SIZE = 50;

// Search, filter, and paging all happen server-side now (see listUsers/countUsers, server/db.js)
// instead of filtering whatever page happened to be in memory — `users` here is only ever the
// current page's rows, and `total` is a real count across the whole (filtered) result set. Same
// reasoning as FamiliesScreen: at real scale, loading every user to filter client-side doesn't
// work.
export const UsersScreen = ({ users, openUser, onSuspend, query, onQueryChange, filter, onFilterChange, page, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const start = total === 0 ? 0 : page * USERS_PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * USERS_PAGE_SIZE);
  return (
    <div className="rf-fade">
      <TableCard
        columns={["User", "User ID", "Mobile", "Email", "State / District", "Package", "Events", "Gifts", "Status", "Last Login", "Actions"]}
        rows={users}
        empty="No users match this search/filter."
        controls={<>
          <SearchBox placeholder="Search name, mobile, email…" value={query} onChange={onQueryChange} />
          <FilterChips items={["All", "Active", "Suspended", "Blocked", "Regular", "Pro", "Advanced"]} active={filter} onSelect={onFilterChange} />
        </>}
        footer={<>
          <span>{total === 0 ? "No users found" : `Showing ${start}–${end} of ${total.toLocaleString()} users`}</span>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft size={13} /> Prev</button>
              <span>Page {page + 1} of {totalPages}</span>
              <button className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next <ChevronRight size={13} /></button>
            </div>
          )}
        </>}
        renderRow={(u) => (
          <tr key={u.id}>
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => openUser(u.id)}>
                <Avatar name={u.name} />
                <div>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{u.city}</div>
                </div>
              </div>
            </td>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.primary, fontWeight: 600 }}>{u.uid}</td>
            <td style={{ color: C.sub }}>{u.mobile}</td>
            <td style={{ color: C.sub }}>{u.email}</td>
            <td style={{ color: C.sub, fontSize: 12.5 }}>{u.state !== "—" || u.district !== "—" ? `${u.district !== "—" ? u.district : ""}${u.district !== "—" && u.state !== "—" ? ", " : ""}${u.state !== "—" ? u.state : ""}` : "—"}</td>
            <td><Chip text={u.pkg} /></td>
            <td style={{ fontWeight: 600 }}>{u.events}</td>
            <td style={{ fontWeight: 600 }}>{u.gifts}</td>
            <td><Chip text={u.status} /></td>
            <td style={{ color: C.sub }}>{u.last}</td>
            <td>
              <div style={{ display: "flex", gap: 4 }}>
                <button title="View" className="rf-icon-btn" style={{ width: 30, height: 30, border: "none" }} onClick={() => openUser(u.id)}><Eye size={14} /></button>
                <button title={u.status === "Suspended" ? "Reactivate" : "Suspend"} className="rf-icon-btn" style={{ width: 30, height: 30, border: "none", color: u.status === "Suspended" ? C.success : C.error }} onClick={() => onSuspend(u.id, u.status)}>
                  {u.status === "Suspended" ? <RefreshCw size={14} /> : <Ban size={14} />}
                </button>
              </div>
            </td>
          </tr>
        )}
      />
    </div>
  );
};

export const UserDetails = ({ user, back, onSuspend }) => {
  const [tab, setTab] = useState("Overview");
  const u = user;
  if (!u) return <div className="rf-fade" style={{ padding: 30, color: C.sub, fontSize: 13 }}>Loading…</div>;
  const sub = u.subscription;
  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <button className="rf-btn ghost" style={{ width: "fit-content" }} onClick={back}><ChevronLeft size={14} /> Back to Users</button>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="rf-card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Avatar name={u.name} size={76} /></div>
            <div style={{ marginTop: 14, fontSize: 17, fontWeight: 700 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: C.primary, fontFamily: "ui-monospace, monospace", fontWeight: 600, marginTop: 2 }}>RLF-{10000 + u.id}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{u.address || "No address on file"}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
              <Chip text={u.status} /><Chip text={u.package_id ? u.package_id[0].toUpperCase() + u.package_id.slice(1) : "Regular"} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="rf-btn primary" style={{ flex: 1, justifyContent: "center" }}><Pencil size={14} /> Edit</button>
              {u.status === "Suspended"
                ? <button className="rf-btn ghost" style={{ flex: 1, justifyContent: "center", color: C.success }} onClick={() => onSuspend(u.id, u.status)}><RefreshCw size={14} /> Reactivate</button>
                : <button className="rf-btn ghost" style={{ flex: 1, justifyContent: "center", color: C.error }} onClick={() => onSuspend(u.id, u.status)}><Ban size={14} /> Suspend</button>}
            </div>
          </div>
          <SectionCard title="Subscription">
            {sub ? [["Package", sub.package_name], ["Amount", sub.amount ? inr(sub.amount) + " / mo" : "Free"], ["Activated", new Date(sub.activated_at).toLocaleDateString()], ["Expires", sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"], ["Payment status", sub.status]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
                <span style={{ color: C.sub }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{k === "Payment status" ? <Chip text={v} /> : v}</span>
              </div>
            )) : <div style={{ fontSize: 13, color: C.sub }}>On Regular (free) — no payment record.</div>}
          </SectionCard>
          <SectionCard title="Personal Information">
            {[["Mobile", u.mobile], ["Email", u.email], ["State", u.state || "—"], ["District", u.district || "—"], ["Registered", new Date(u.created_at).toLocaleDateString()]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
                <span style={{ color: C.sub }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </SectionCard>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="rf-card" style={{ padding: "0 22px" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
              {["Overview", "Events", "Gifts"].map((t) => (
                <button key={t} className={`rf-tab ${tab === t ? "active" : ""}`} style={{ background: "none", border: "none", borderBottom: tab === t ? `2px solid ${C.primary}` : "2px solid transparent" }} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div style={{ padding: "20px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {[["Events hosted", u.events_count, C.primary, C.primarySoft], ["Gifts recorded", u.gifts_count, "#E48BA5", "#FDF1F4"], ["Total moi value", inr(u.gifts_total), C.gold, C.goldSoft]].map(([k, v, tint, soft]) => (
                  <div key={k} style={{ background: soft, borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 12, color: C.sub }}>{k}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: tint, marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SectionCard title="Recent Events">
            {(u.events || []).length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>No events yet.</div> : u.events.map((e) => (
              <div key={e.client_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.goldSoft, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}><CalendarDays size={15} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{e.date} · {e.type}</div>
                </div>
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Recent Gift Records">
            {(u.gifts || []).length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>No gift records yet.</div> : u.gifts.map((g) => (
              <div key={g.client_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F1F3F6", fontSize: 13 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{g.person || "—"} · {g.direction === "received" ? "received" : "given"}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{g.date} · {g.mode}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{inr(g.amount)}</div>
                <Chip text={g.status} />
              </div>
            ))}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
