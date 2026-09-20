const BASE = import.meta.env.VITE_API_URL || "http://localhost:4100";
const TOKEN_KEY = "relfam_admin_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    throw new Error("Session expired");
  }
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request("/api/admin/auth/login", { method: "POST", body: { email, password } }),
  tfaVerify: (tempToken, code) => request("/api/admin/auth/tfa/verify", { method: "POST", body: { tempToken, code } }),
  logout: () => request("/api/admin/auth/logout", { method: "POST" }),
  me: () => request("/api/admin/auth/me"),

  dashboard: () => request("/api/admin/dashboard"),

  users: (q, filter, page = 0) => request("/api/admin/users" + `?page=${page}`
    + (q ? `&q=${encodeURIComponent(q)}` : "")
    + (filter && filter !== "All" ? `&filter=${encodeURIComponent(filter)}` : "")),
  userDetail: (id) => request(`/api/admin/users/${id}`),
  setUserStatus: (id, status) => request(`/api/admin/users/${id}/status`, { method: "PATCH", body: { status } }),

  events: () => request("/api/admin/events"),

  gifts: (q) => request("/api/admin/gifts" + (q ? `?q=${encodeURIComponent(q)}` : "")),
  setGiftStatus: (ownerUserId, clientId, status) =>
    request(`/api/admin/gifts/${ownerUserId}/${clientId}/status`, { method: "PATCH", body: { status } }),

  families: (q, page = 0) => request("/api/admin/families" + `?page=${page}` + (q ? `&q=${encodeURIComponent(q)}` : "")),
  removeFamilyMember: (id) => request(`/api/admin/families/member/${id}`, { method: "DELETE" }),
  addFamilyMember: (primaryUserId, body) => request(`/api/admin/families/${primaryUserId}/members`, { method: "POST", body }),

  packages: () => request("/api/admin/packages"),
  updatePackage: (id, patch) => request(`/api/admin/packages/${id}`, { method: "PATCH", body: patch }),
  subscriptions: () => request("/api/admin/subscriptions"),
  createSubscription: (body) => request("/api/admin/subscriptions", { method: "POST", body }),
  setSubscriptionStatus: (id, status) => request(`/api/admin/subscriptions/${id}/status`, { method: "PATCH", body: { status } }),

  feedback: (status, rating) => request("/api/admin/feedback" + (status || rating ? `?status=${encodeURIComponent(status || "All")}&rating=${encodeURIComponent(rating || "All")}` : "")),
  setFeedbackStatus: (id, status) => request(`/api/admin/feedback/${id}/status`, { method: "PATCH", body: { status } }),
  featureInterest: () => request("/api/admin/feature-interest"),
  referralRewards: (status) => request("/api/admin/referral-rewards" + (status ? `?status=${encodeURIComponent(status)}` : "")),
  reviewReferralReward: (id, status, note, reference) => request(`/api/admin/referral-rewards/${id}`, { method: "PATCH", body: { status, note, reference } }),
  referralSummary: () => request("/api/admin/referral-summary"),
  reopenReferralReward: (id, note) => request(`/api/admin/referral-rewards/${id}/reopen`, { method: "POST", body: { note } }),

  fraudCases: () => request("/api/admin/fraud-cases"),
  createFraudCase: (body) => request("/api/admin/fraud-cases", { method: "POST", body }),
  setFraudStatus: (id, status) => request(`/api/admin/fraud-cases/${id}/status`, { method: "PATCH", body: { status } }),
  scanFraud: () => request("/api/admin/fraud-cases/scan", { method: "POST" }),

  tickets: () => request("/api/admin/tickets"),
  createTicket: (body) => request("/api/admin/tickets", { method: "POST", body }),
  updateTicket: (id, patch) => request(`/api/admin/tickets/${id}`, { method: "PATCH", body: patch }),

  ads: () => request("/api/admin/ads"),
  createAd: (body) => request("/api/admin/ads", { method: "POST", body }),
  setAdStatus: (id, status) => request(`/api/admin/ads/${id}/status`, { method: "PATCH", body: { status } }),
  deleteAd: (id) => request(`/api/admin/ads/${id}`, { method: "DELETE" }),

  faqs: () => request("/api/admin/faqs"),
  createFaq: (body) => request("/api/admin/faqs", { method: "POST", body }),
  toggleFaq: (id) => request(`/api/admin/faqs/${id}/toggle`, { method: "PATCH" }),
  deleteFaq: (id) => request(`/api/admin/faqs/${id}`, { method: "DELETE" }),

  announcements: () => request("/api/admin/announcements"),
  createAnnouncement: (body) => request("/api/admin/announcements", { method: "POST", body }),
  toggleAnnouncement: (id) => request(`/api/admin/announcements/${id}/toggle`, { method: "PATCH" }),
  deleteAnnouncement: (id) => request(`/api/admin/announcements/${id}`, { method: "DELETE" }),

  settings: () => request("/api/admin/settings"),
  updateSetting: (key, value) => request(`/api/admin/settings/${key}`, { method: "PATCH", body: value }),
  runBackup: () => request("/api/admin/backup/run", { method: "POST" }),

  admins: () => request("/api/admin/admins"),
  createAdmin: (body) => request("/api/admin/admins", { method: "POST", body }),
  updateAdmin: (id, patch) => request(`/api/admin/admins/${id}`, { method: "PATCH", body: patch }),
  toggleAdminTfa: (id) => request(`/api/admin/admins/${id}/toggle-tfa`, { method: "PATCH" }),
  deleteAdmin: (id) => request(`/api/admin/admins/${id}`, { method: "DELETE" }),

  auditLogs: () => request("/api/admin/audit-logs"),

  broadcastPush: (body) => request("/api/admin/notifications/broadcast", { method: "POST", body }),
  schedulePush: (body) => request("/api/admin/notifications/schedule", { method: "POST", body }),
  scheduledNotifications: () => request("/api/admin/notifications/scheduled"),
  cancelScheduledNotification: (id) => request(`/api/admin/notifications/scheduled/${id}`, { method: "DELETE" }),
};

/* ─────────────────────────── Mapping: API rows -> UI shape ───────────────────────────
   The dashboard's screens were designed against a fixed mock shape (uid, city, country, pkg,
   reg, last, etc). Rather than rewrite every screen's render code, these adapters translate the
   real, sparser database rows into that same shape — fields the real schema doesn't track
   (country, city as a distinct field) fall back to "—" instead of being invented. */

const MONTH_ABBR = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export function parseFreeDate(value) {
  const parts = String(value || "").trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const [day, monStr, year] = parts;
  const month = MONTH_ABBR.indexOf(monStr.toLowerCase().slice(0, 3));
  if (month === -1) return null;
  const d = new Date(Number(year), month, Number(day));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIso(date) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${formatDate(value)}, ${time}`;
}

export function mapUser(u) {
  return {
    id: u.id,
    uid: "RLF-" + String(10000 + u.id),
    name: u.name,
    mobile: u.mobile,
    email: u.email,
    state: u.state || "—",
    district: u.district || "—",
    city: u.address || "—",
    reg: formatDate(u.created_at),
    events: u.events_count ?? 0,
    gifts: u.gifts_count ?? 0,
    status: u.status || "Active",
    pkg: u.package_id ? u.package_id[0].toUpperCase() + u.package_id.slice(1) : "Regular",
    last: formatDateTime(u.last_seen_at),
  };
}

export function mapEvent(e) {
  const parsed = parseFreeDate(e.date);
  const now = new Date();
  let status = "Completed";
  if (parsed) {
    const sameDay = parsed.toDateString() === now.toDateString();
    status = sameDay ? "Live" : parsed > now ? "Upcoming" : "Completed";
  }
  return {
    id: "EVT-" + e.owner_user_id + "-" + e.client_id,
    iso: parsed ? toIso(parsed) : "",
    name: e.name || "Untitled event",
    type: e.type || "Other",
    host: e.host_name,
    hostId: e.host_id,
    hostUid: "RLF-" + String(10000 + e.host_id),
    // Who set the event up for the host (Self / Parent / Brother …), as the host chose it. Older events have none.
    createdBy: e.created_by || "Not recorded",
    place: e.venue || "—",
    date: e.date || "—",
    gifts: e.gifts_count ?? 0,
    total: Number(e.total_amount) || 0,
    status,
  };
}

export function mapGift(g) {
  const received = g.direction === "received";
  return {
    id: g.owner_user_id + "-" + g.client_id,
    ownerUserId: g.owner_user_id,
    clientId: g.client_id,
    sender: received ? g.person : g.owner_name,
    receiver: received ? g.owner_name : g.person,
    event: g.event_name || "—",
    amount: Number(g.amount) || 0,
    type: g.mode || "—",
    date: g.date || "—",
    status: g.status || "—",
  };
}

export function mapFamily(f) {
  return {
    id: "fam" + f.primary_user_id,
    primaryUserId: f.primary_user_id,
    name: f.head_name + "'s Family",
    head: f.head_name,
    events: f.events_count ?? 0,
    moi: Number(f.moi_total) || 0,
    members: (f.members || []).map((m) => ({ id: m.id, name: m.name, relation: m.relation, role: "Member" })),
  };
}

export function mapSubscription(s) {
  const now = Date.now();
  const activated = new Date(s.activated_at);
  const when = Date.now() - activated.getTime() < 86400e3 ? "today"
    : Date.now() - activated.getTime() < 7 * 86400e3 ? "week"
    : Date.now() - activated.getTime() < 30 * 86400e3 ? "month" : "older";
  return {
    id: "SUB-" + s.id,
    rawId: s.id,
    user: s.user_name,
    pkg: s.package_name,
    amount: Number(s.amount) || 0,
    activated: formatDate(s.activated_at),
    when,
    expires: s.expires_at ? formatDate(s.expires_at) : "—",
    method: s.method || "—",
    status: s.status,
  };
}

export function mapFeedback(f) {
  return {
    id: f.id,
    userId: f.user_id,
    user: f.user_name,
    mobile: f.mobile,
    email: f.email,
    rating: f.rating,
    message: f.message,
    status: f.status,
    created: formatDateTime(f.created_at),
  };
}

export function mapReferralReward(r) {
  return {
    id: r.id,
    referrerId: r.referrer_user_id,
    referrer: r.referrer_name,
    referrerMobile: r.referrer_mobile,
    referrerStatus: r.referrer_status,
    referrerJoined: r.referrer_joined_at ? formatDateTime(r.referrer_joined_at) : "—",
    referee: r.referee_name,
    refereeMobile: r.referee_mobile,
    refereeJoined: r.referee_joined_at ? formatDateTime(r.referee_joined_at) : "—",
    amount: r.amount,
    status: r.status,
    upi: r.claim_upi_id || "",
    flags: r.flags || r.risk_flags || [],
    earned: formatDateTime(r.earned_at),
    claimed: r.claimed_at ? formatDateTime(r.claimed_at) : "—",
    reviewed: r.reviewed_at ? formatDateTime(r.reviewed_at) : "",
    note: r.review_note || "",
    payoutRef: r.payout_ref || "",
    reopened: r.reopened_at ? formatDateTime(r.reopened_at) : "",
    priorRejection: r.prior_rejection_note || "",
    // Evidence for the decision: what the friend actually did, and the referrer's track record.
    evidence: {
      events: r.referee_events || 0,
      eventList: r.referee_event_list || "",
      entries: r.referee_entries || 0,
      givers: r.referee_givers || 0,
      collected: r.referee_collected || 0,
      referrerInvited: r.referrer_invited || 0,
      referrerQualified: r.referrer_qualified || 0,
      referrerPaid: r.referrer_paid_total || 0,
    },
  };
}

export function mapFraudCase(c) {
  return {
    id: "FRD-" + c.id,
    rawId: c.id,
    userId: c.user_id,
    type: c.type,
    severity: c.severity,
    detected: formatDateTime(c.detected_at),
    status: c.status,
    evidence: c.evidence || "No further evidence recorded.",
    signal: c.signal || "—",
  };
}

export function mapTicket(t) {
  return {
    id: "TKT-" + t.id,
    rawId: t.id,
    user: t.user_name,
    userId: t.user_id,
    cat: t.category,
    priority: t.priority,
    assigned: t.assigned_name ? `${t.assigned_name} (${t.assigned_role})` : "Unassigned",
    status: t.status,
    created: formatDate(t.created_at),
  };
}

export function mapAd(a) {
  return {
    id: "AD-" + a.id,
    rawId: a.id,
    title: a.title,
    body: a.body || "",
    image: a.image || "",
    link: a.link_url || "",
    evType: a.event_type,
    user: a.target_user_names?.length ? (a.target_user_names.length > 2 ? `${a.target_user_names.length} users` : a.target_user_names.join(", ")) : "All users",
    maxPerDay: a.max_per_day || null,
    dateMode: a.date_mode,
    from: a.from_date || "",
    to: a.to_date || "",
    targetStates: a.target_states || [],
    targetDistricts: a.target_districts || [],
    placement: a.placement,
    status: a.status,
    created: formatDate(a.created_at),
  };
}

export function mapAdmin(a) {
  return { ...a, id: a.id, last: a.lastActive ? formatDateTime(a.lastActive) : "Never logged in" };
}

export function mapScheduled(s) {
  return {
    id: s.id,
    title: s.title,
    body: s.body,
    audience: s.target_user_names?.length ? `${s.target_user_names.length > 2 ? s.target_user_names.length + " users" : s.target_user_names.join(", ")}` : (s.target_states?.length ? `${s.audience} · ${s.target_states.length} state(s)` : s.audience),
    targetStates: s.target_states || [],
    targetDistricts: s.target_districts || [],
    scheduledAt: formatDateTime(s.scheduled_at),
    status: s.status,
    sentCount: s.sent_count,
    failedCount: s.failed_count,
    error: s.error || "",
    createdBy: s.created_by_name || "—",
  };
}

export function mapLog(l) {
  return {
    admin: l.admin_name || "System",
    action: l.action,
    module: l.module || "—",
    ip: l.ip || "—",
    device: l.device || "—",
    time: formatDateTime(l.created_at),
  };
}
