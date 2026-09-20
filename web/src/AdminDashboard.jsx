import React, { useEffect, useState } from "react";
import {
  ChevronLeft, Bell, HelpCircle, LogOut, ShieldAlert, UserPlus, Gift, Crown, LifeBuoy,
} from "lucide-react";
import { C, css, inr, MENU } from "./theme";
import { Avatar } from "./components/shared";
import GlobalSearch from "./components/GlobalSearch";
import {
  api, mapUser, mapEvent, mapGift, mapFamily, mapSubscription, mapFraudCase, mapTicket,
  mapAd, mapAdmin, mapLog, mapFeedback, mapScheduled, mapReferralReward,
} from "./api";

import Dashboard from "./screens/Dashboard";
import { UsersScreen, UserDetails } from "./screens/Users";
import EventsScreen from "./screens/Events";
import { GiftsScreen, GiftDrawer } from "./screens/Gifts";
import PaymentsScreen from "./screens/Payments";
import { FamiliesScreen, FamilyDetail } from "./screens/Families";
import FraudScreen from "./screens/Fraud";
import ReportsScreen from "./screens/Reports";
import AnalyticsScreen from "./screens/Analytics";
import NotificationsScreen from "./screens/Notifications";
import AdsScreen from "./screens/Ads";
import SupportScreen from "./screens/Support";
import FeedbackScreen from "./screens/Feedback";
import ReferralsScreen from "./screens/Referrals";
import FeatureInterestScreen from "./screens/FeatureInterest";
import SystemHealthScreen from "./screens/SystemHealth";
import ContentScreen from "./screens/Content";
import SettingsScreen from "./screens/Settings";
import AdminsScreen from "./screens/Admins";
import AuditScreen from "./screens/Audit";

function monthKey(iso) { const d = new Date(iso); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); }
function monthLabel(iso) { const d = new Date(iso); return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }); }
function spark(rows, field, n = 7) {
  const vals = (rows || []).map((r) => Number(r[field]) || 0);
  const last = vals.slice(-n);
  return last.length ? last : [0, 0];
}
function pctGrowth(rows, field) {
  const vals = (rows || []).map((r) => Number(r[field]) || 0);
  if (vals.length < 2) return 0;
  const prev = vals[vals.length - 2], last = vals[vals.length - 1];
  if (!prev) return last ? 100 : 0;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

function buildCharts(series) {
  const activeMap = {};
  (series.activeByMonth || []).forEach((r) => { activeMap[monthKey(r.m)] = r.n; });
  let cumulative = 0;
  const growth = (series.signups || []).map((r) => {
    cumulative += r.n;
    return { m: monthLabel(r.m), users: cumulative, dau: activeMap[monthKey(r.m)] || 0 };
  });
  const eventsByMonth = (series.eventsByMonth || []).map((r) => ({ m: monthLabel(r.m), events: r.n }));
  const giftTrend = (series.giftsByMonth || []).map((r) => ({ m: monthLabel(r.m), value: Number(r.total) }));
  const revenue = (series.revenueByMonth || []).map((r) => ({ m: monthLabel(r.m), rev: Number(r.total) }));
  const totalEventCount = (series.eventTypes || []).reduce((a, r) => a + r.n, 0) || 1;
  const palette = [C.primary, C.gold, C.pink, C.success, "#8B5CF6", "#C4CBD8"];
  const eventTypes = (series.eventTypes || []).map((r, i) => ({ name: r.type, value: Math.round((r.n / totalEventCount) * 100), color: palette[i % palette.length] }));
  return { growth, eventsByMonth, giftTrend, revenue, eventTypes };
}

function buildKpis(dashboard, eventsToday) {
  const { kpis, series } = dashboard;
  return {
    ...kpis,
    eventsToday,
    userGrowthPct: pctGrowth(series.signups, "n"),
    activeGrowthPct: pctGrowth(series.activeByMonth, "n"),
    eventGrowthPct: pctGrowth(series.eventsByMonth, "n"),
    giftGrowthPct: pctGrowth(series.giftsByMonth, "total"),
    userSpark: spark(series.signups, "n"),
    activeSpark: spark(series.activeByMonth, "n"),
    eventSpark: spark(series.eventsByMonth, "n"),
    giftSpark: spark(series.giftsByMonth, "total"),
    giftValueSpark: spark(series.giftsByMonth, "total"),
  };
}

function buildActivity(users, gifts, fraudCases, tickets, subs) {
  const items = [];
  if (gifts[0]) items.push({ icon: Gift, tint: "#E48BA5", soft: "#FDF1F4", title: "Gift recorded", sub: `${inr(gifts[0].amount)} · ${gifts[0].sender} → ${gifts[0].receiver}`, time: gifts[0].date, badge: [gifts[0].status, C.success, C.successSoft] });
  if (users[0]) items.push({ icon: UserPlus, tint: C.primary, soft: C.primarySoft, title: "New user registered", sub: `${users[0].name} · ${users[0].city}`, time: users[0].reg, badge: ["New", C.primary, C.primarySoft] });
  if (fraudCases[0]) items.push({ icon: ShieldAlert, tint: C.error, soft: C.errorSoft, title: "Fraud case: " + fraudCases[0].type, sub: fraudCases[0].id, time: fraudCases[0].detected, badge: [fraudCases[0].severity, C.error, C.errorSoft] });
  if (subs[0]) items.push({ icon: Crown, tint: C.gold, soft: C.goldSoft, title: `${subs[0].pkg} package activated`, sub: `${subs[0].user} · ${inr(subs[0].amount)}`, time: subs[0].activated, badge: [subs[0].status, C.success, C.successSoft] });
  if (tickets[0]) items.push({ icon: LifeBuoy, tint: C.error, soft: C.errorSoft, title: "Support ticket created", sub: `${tickets[0].id} · ${tickets[0].cat}`, time: tickets[0].created, badge: [tickets[0].status, C.error, C.errorSoft] });
  return items;
}

export default function RelfamAdmin({ admin, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [dashboard, setDashboard] = useState({ kpis: { totalUsers: 0, activeUsers: 0, totalEvents: 0, giftsRecorded: 0, totalGiftValue: 0, paidSubscribers: 0, openFraudCases: 0 }, series: {} });
  const [users, setUsers] = useState([]);
  const [userDetail, setUserDetail] = useState(null);
  const [events, setEvents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [packages, setPackages] = useState([]);
  const [subs, setSubs] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [referralRewards, setReferralRewards] = useState([]);
  const [referralSummary, setReferralSummary] = useState(null);
  const [interest, setInterest] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [fraudCases, setFraudCases] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ads, setAds] = useState([]);
  const [faq, setFaq] = useState([]);
  const [announces, setAnnounces] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({});

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [drawerGiftId, setDrawerGiftId] = useState(null);

  // Families load a page (and a real total) at a time rather than every family at once — see
  // listFamilies/countFamilies (server/db.js): at real scale, one unbounded query returning every
  // family in one response is the kind of thing that works fine in a demo and falls over in
  // production.
  const [familiesQuery, setFamiliesQuery] = useState("");
  const [familiesPage, setFamiliesPage] = useState(0);
  const [familiesTotal, setFamiliesTotal] = useState(0);

  // Same server-side search/filter/page pattern as Families — see loadFamilies' own comment.
  const [usersQuery, setUsersQuery] = useState("");
  const [usersFilter, setUsersFilter] = useState("All");
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);

  const loadDashboard = () => api.dashboard().then((d) => setDashboard(d));
  const loadUsers = (q = usersQuery, filter = usersFilter, page = usersPage) =>
    api.users(q, filter, page).then((d) => { setUsers(d.users.map(mapUser)); setUsersTotal(d.total); });
  const loadEvents = () => api.events().then((d) => setEvents(d.events.map(mapEvent)));
  const loadGifts = () => api.gifts().then((d) => setGifts(d.gifts.map(mapGift)));
  const loadFamilies = (q = familiesQuery, page = familiesPage) =>
    api.families(q, page).then((d) => { setFamilies(d.families.map(mapFamily)); setFamiliesTotal(d.total); });
  const loadPackages = () => api.packages().then((d) => setPackages(d.packages));
  const loadSubs = () => api.subscriptions().then((d) => setSubs(d.subscriptions.map(mapSubscription)));
  const loadFeedback = () => api.feedback().then((d) => setFeedback(d.feedback.map(mapFeedback)));
  const loadReferralRewards = () => Promise.all([
    api.referralRewards().then((d) => setReferralRewards(d.rewards.map(mapReferralReward))),
    api.referralSummary().then((d) => setReferralSummary({ totals: d.totals, pool: d.pool, referrers: d.referrers || [] })),
  ]);
  const loadInterest = () => api.featureInterest().then((d) => setInterest(d)).catch(() => setInterest(null));
  const loadScheduled = () => api.scheduledNotifications().then((d) => setScheduled(d.scheduled.map(mapScheduled)));
  const loadFraud = () => api.fraudCases().then((d) => setFraudCases(d.cases.map(mapFraudCase)));
  const loadTickets = () => api.tickets().then((d) => setTickets(d.tickets.map(mapTicket)));
  const loadAds = () => api.ads().then((d) => setAds(d.ads.map(mapAd)));
  const loadFaq = () => api.faqs().then((d) => setFaq(d.faqs));
  const loadAnnounces = () => api.announcements().then((d) => setAnnounces(d.announcements));
  const loadAdmins = () => api.admins().then((d) => setAdmins(d.admins.map(mapAdmin)));
  const loadLogs = () => api.auditLogs().then((d) => setLogs(d.logs.map(mapLog)));
  const loadSettings = () => api.settings().then((d) => setSettings(d.settings));

  useEffect(() => {
    Promise.all([
      loadDashboard(), loadUsers(), loadEvents(), loadGifts(), loadFamilies(), loadPackages(),
      loadSubs(), loadFraud(), loadFeedback(), loadReferralRewards(), loadInterest(), loadScheduled(), loadTickets(), loadAds(), loadFaq(), loadAnnounces(),
      loadAdmins(), loadLogs(), loadSettings(),
    ]).then(() => setLoaded(true)).catch((err) => { console.error(err); setLoaded(true); });
  }, []);

  // Debounced so typing a search term doesn't fire a request per keystroke; resets to page 0
  // since a new search invalidates whatever page you were on. Skipped until the initial load
  // above has already fetched page 0 once, so this doesn't double-fetch on mount.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { setFamiliesPage(0); loadFamilies(familiesQuery, 0); }, 300);
    return () => clearTimeout(t);
  }, [familiesQuery]);

  const goToFamiliesPage = (p) => { setFamiliesPage(p); loadFamilies(familiesQuery, p); };

  // Search debounced same as families; the filter chip fires immediately (a click, not typing,
  // so there's nothing to debounce) and also resets to page 0.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { setUsersPage(0); loadUsers(usersQuery, usersFilter, 0); }, 300);
    return () => clearTimeout(t);
  }, [usersQuery]);

  const setUsersFilterAndLoad = (f) => { setUsersFilter(f); setUsersPage(0); loadUsers(usersQuery, f, 0); };
  const goToUsersPage = (p) => { setUsersPage(p); loadUsers(usersQuery, usersFilter, p); };

  const openUser = (id) => { setSelectedUserId(id); setUserDetail(null); setPage("userDetails"); api.userDetail(id).then((d) => setUserDetail(d.user)); };
  const openFamily = (id) => { setSelectedFamilyId(id); setPage("familyDetail"); };
  const openGift = (id) => { setPage("gifts"); setDrawerGiftId(id); };

  const toggleSuspend = async (id, currentStatus) => {
    const next = currentStatus === "Suspended" ? "Active" : "Suspended";
    await api.setUserStatus(id, next);
    await loadUsers();
    if (selectedUserId === id) api.userDetail(id).then((d) => setUserDetail(d.user));
    loadLogs();
  };

  const setGiftStatus = async (gift, status) => {
    await api.setGiftStatus(gift.ownerUserId, gift.clientId, status);
    await loadGifts();
    loadLogs();
  };

  const drawerGift = gifts.find((g) => g.id === drawerGiftId);
  const charts = buildCharts(dashboard.series || {});
  const kpis = buildKpis(dashboard, events.filter((e) => e.status === "Live").length);
  const activity = buildActivity(users, gifts, fraudCases, tickets, subs);

  const current = MENU.find((m) => m.id === page);
  const title = page === "userDetails" ? "User Details" : page === "familyDetail" ? "Manage Family" : current?.label || "Dashboard";
  const subtitle = {
    dashboard: `Vanakkam, ${admin.name.split(" ")[0]} — here's how Relfam is doing today.`,
    payments: "Regular, Pro & Advanced packages · who paid, who's active, and where payments failed.",
    fraud: "Log cases manually, or scan real activity for velocity spikes — full user context for each one.",
    support: "Every ticket gets an owner — assign on creation, reassign anytime.",
    referrals: "Check the evidence, send the money to the UPI ID yourself, then mark it paid with the payment reference — the person is notified and sees Paid in their app.",
    feedback: "Ratings and comments submitted from the app's Feedback screen, newest first.",
    interest: "How many people opened each Coming soon tile in the app, and how many asked to be told when it is ready.",
    health: "Is the server up, can the backups really be restored, and what has been going wrong. Refreshes every 30 seconds.",
    families: "Family links captured by the app, grouped by the account that added them.",
    content: "FAQ and announcements are live-edited here; onboarding/theme copy is reference-only for now.",
    events: "Filter by user and date range, then export the view as CSV.",
    ads: "Publish ads to all event types — or target by event type and user, with a daily dismiss cap per person.",
    settings: "Every section opens with live, editable controls.",
    admins: "Super Admin adds admins and grants access to specific screens.",
  }[page] || `Manage ${title.toLowerCase()} across the Relfam platform.`;

  const screens = {
    dashboard: <Dashboard kpis={kpis} charts={charts} activity={activity} goFraud={() => setPage("fraud")} goAds={() => setPage("ads")} goSupport={() => setPage("support")} goNotifications={() => setPage("notifications")} />,
    users: <UsersScreen users={users} openUser={openUser} onSuspend={toggleSuspend}
      query={usersQuery} onQueryChange={setUsersQuery}
      filter={usersFilter} onFilterChange={setUsersFilterAndLoad}
      page={usersPage} total={usersTotal} onPageChange={goToUsersPage} />,
    userDetails: <UserDetails user={userDetail} back={() => setPage("users")} onSuspend={toggleSuspend} />,
    events: <EventsScreen events={events} />,
    gifts: <GiftsScreen gifts={gifts} openDrawer={setDrawerGiftId} />,
    payments: <PaymentsScreen packages={packages} subs={subs} users={users}
      onRetry={async (id) => { await api.setSubscriptionStatus(id, "Active"); await loadSubs(); loadLogs(); }}
      onDeactivate={async (id) => { await api.setSubscriptionStatus(id, "Inactive"); await loadSubs(); loadLogs(); }}
      onReactivate={async (id) => { await api.setSubscriptionStatus(id, "Active"); await loadSubs(); loadLogs(); }} />,
    families: <FamiliesScreen families={families} openFamily={openFamily}
      query={familiesQuery} onQueryChange={setFamiliesQuery}
      page={familiesPage} total={familiesTotal} onPageChange={goToFamiliesPage} />,
    familyDetail: <FamilyDetail family={families.find((f) => f.id === selectedFamilyId)} back={() => setPage("families")}
      onAddMember={async (primaryUserId, body) => { await api.addFamilyMember(primaryUserId, body); await loadFamilies(); loadLogs(); }}
      onRemoveMember={async (id) => { await api.removeFamilyMember(id); await loadFamilies(); loadLogs(); }} />,
    fraud: <FraudScreen cases={fraudCases} users={users} onSuspend={toggleSuspend} openUser={openUser}
      onSetStatus={async (id, status) => { await api.setFraudStatus(id, status); await loadFraud(); await loadDashboard(); loadLogs(); }}
      onCreate={async (body) => { await api.createFraudCase(body); await loadFraud(); await loadDashboard(); loadLogs(); }}
      onScan={async () => { const r = await api.scanFraud(); await loadFraud(); await loadDashboard(); loadLogs(); return r; }} />,
    reports: <ReportsScreen kpis={kpis} charts={charts} />,
    analytics: <AnalyticsScreen charts={charts} users={users} />,
    notifications: <NotificationsScreen users={users} scheduled={scheduled}
      onSendPush={async (body) => { const r = await api.broadcastPush(body); loadLogs(); return r; }}
      onSchedule={async (body) => { const r = await api.schedulePush(body); await loadScheduled(); loadLogs(); return r; }}
      onCancelScheduled={async (id) => { await api.cancelScheduledNotification(id); await loadScheduled(); loadLogs(); }} />,
    ads: <AdsScreen ads={ads} events={events} users={users}
      onPublish={async (body) => { await api.createAd(body); await loadAds(); loadLogs(); }}
      onToggle={async (id, status) => { await api.setAdStatus(id, status); await loadAds(); loadLogs(); }}
      onDelete={async (id) => { await api.deleteAd(id); await loadAds(); loadLogs(); }} />,
    support: <SupportScreen tickets={tickets} users={users} admins={admins}
      onCreate={async (body) => { await api.createTicket(body); await loadTickets(); loadLogs(); }}
      onReassign={async (id, adminId) => { await api.updateTicket(id, { assignedAdminId: adminId }); await loadTickets(); loadLogs(); }}
      onResolve={async (id) => { await api.updateTicket(id, { status: "Resolved" }); await loadTickets(); loadLogs(); }} />,
    feedback: <FeedbackScreen feedback={feedback}
      onSetStatus={async (id, status) => { await api.setFeedbackStatus(id, status); await loadFeedback(); loadLogs(); }} />,
    interest: <FeatureInterestScreen data={interest} onRefresh={loadInterest} />,
    health: <SystemHealthScreen />,
    referrals: <ReferralsScreen rewards={referralRewards} summary={referralSummary}
      onReview={async (id, status, note, reference) => { await api.reviewReferralReward(id, status, note, reference); await loadReferralRewards(); loadLogs(); }}
      onFraud={async (r, evidence) => { await api.createFraudCase({ userId: r.referrerId, type: "Referral abuse", severity: r.flags.length >= 2 ? "High" : "Medium", evidence, signal: r.flags.join(", ") || "Manual flag from Referral Payouts" }); await loadFraud(); await loadDashboard(); loadLogs(); }}
      onReopen={async (id, note) => { await api.reopenReferralReward(id, note); await loadReferralRewards(); loadLogs(); }}
      onSuspend={async (id, currentStatus) => { await toggleSuspend(id, currentStatus); await loadReferralRewards(); }} />,
    content: <ContentScreen faq={faq} announces={announces}
      onAddFaq={async (b) => { await api.createFaq(b); await loadFaq(); loadLogs(); }}
      onToggleFaq={async (id) => { await api.toggleFaq(id); await loadFaq(); loadLogs(); }}
      onDeleteFaq={async (id) => { await api.deleteFaq(id); await loadFaq(); loadLogs(); }}
      onAddAnnouncement={async (b) => { await api.createAnnouncement(b); await loadAnnounces(); loadLogs(); }}
      onToggleAnnouncement={async (id) => { await api.toggleAnnouncement(id); await loadAnnounces(); loadLogs(); }}
      onDeleteAnnouncement={async (id) => { await api.deleteAnnouncement(id); await loadAnnounces(); loadLogs(); }} />,
    settings: <SettingsScreen settings={settings}
      onSave={async (key, value) => { await api.updateSetting(key, value); await loadSettings(); loadLogs(); }}
      onSavePackages={async (pkgState) => { await Promise.all([api.updatePackage("pro", { price: Number(pkgState.pro) }), api.updatePackage("advanced", { price: Number(pkgState.adv) })]); await loadPackages(); }}
      onRunBackup={async () => { const r = await api.runBackup(); await loadSettings(); loadLogs(); return r; }} />,
    admins: <AdminsScreen admins={admins} currentAdminId={admin.id}
      onCreate={async (b) => { await api.createAdmin(b); await loadAdmins(); loadLogs(); }}
      onUpdateAccess={async (id, patch) => { await api.updateAdmin(id, patch); await loadAdmins(); loadLogs(); }}
      onToggleTfa={async (id) => { await api.toggleAdminTfa(id); await loadAdmins(); loadLogs(); }}
      onRemove={async (id) => { await api.deleteAdmin(id); await loadAdmins(); loadLogs(); }} />,
    audit: <AuditScreen logs={logs} />,
  };

  return (
    <div className="rf-root" style={{ display: "flex", minHeight: "100vh" }}>
      <style>{css}</style>

      <aside style={{ width: collapsed ? 76 : 248, background: "#fff", borderRight: `1px solid ${C.border}`, padding: "20px 14px", position: "sticky", top: 0, height: "100vh", overflowY: "auto", transition: "width .3s cubic-bezier(.2,.8,.3,1)", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", marginBottom: 24 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}, #7BA6F5)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0, boxShadow: "0 6px 16px rgba(91,141,239,.35)" }}>R</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.02em" }}>Relfam</div>
              <div style={{ fontSize: 10.5, color: C.gold, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Admin</div>
            </div>
          )}
        </div>
        <nav style={{ display: "grid", gap: 3, flex: 1 }}>
          {MENU.filter((m) => admin.access === "all" || admin.access.includes(m.id)).map((m) => {
            const active = page === m.id || (page === "userDetails" && m.id === "users") || (page === "familyDetail" && m.id === "families");
            return (
              <button key={m.id} className={`rf-side-item ${active ? "active" : ""}`} style={{ border: "none", background: active ? undefined : "none", justifyContent: collapsed ? "center" : "flex-start", width: "100%", position: "relative" }} title={m.label} onClick={() => { setPage(m.id); setSelectedUserId(null); setSelectedFamilyId(null); }}>
                <m.icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && m.label}
                {m.id === "fraud" && kpis.openFraudCases > 0 && (
                  <span style={{ marginLeft: collapsed ? 0 : "auto", position: collapsed ? "absolute" : "static", top: 6, right: 8, minWidth: 18, height: 18, borderRadius: 9, background: C.error, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{kpis.openFraudCases}</span>
                )}
              </button>
            );
          })}
        </nav>
        <button className="rf-side-item" style={{ border: "none", background: "none", marginTop: 12, justifyContent: collapsed ? "center" : "flex-start", width: "100%" }} onClick={() => setCollapsed(!collapsed)}>
          <ChevronLeft size={17} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .3s", flexShrink: 0 }} />
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(248,250,252,.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12.5, color: C.sub, whiteSpace: "nowrap" }}>
            Relfam Admin <span style={{ margin: "0 6px" }}>/</span> <span style={{ color: C.text, fontWeight: 700 }}>{title}</span>
          </div>
          <GlobalSearch users={users} events={events} gifts={gifts} tickets={tickets} subs={subs} go={setPage} openUser={openUser} openGift={openGift} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button className="rf-icon-btn" title="Fraud alerts" style={{ position: "relative", color: kpis.openFraudCases > 0 ? C.error : C.sub }} onClick={() => setPage("fraud")}>
              <ShieldAlert size={16} />
              {kpis.openFraudCases > 0 && <span style={{ position: "absolute", top: 7, right: 8, width: 8, height: 8, borderRadius: "50%", background: C.error, border: "2px solid #fff" }} />}
            </button>
            <button className="rf-icon-btn" title="Notifications" onClick={() => setPage("notifications")}><Bell size={16} /></button>
            <button className="rf-icon-btn" title="Help"><HelpCircle size={16} /></button>
            <div style={{ width: 1, height: 26, background: C.border, margin: "0 6px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={admin.name} size={34} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{admin.name}</div>
                <div style={{ fontSize: 10.5, color: C.sub }}>{admin.role}</div>
              </div>
            </div>
            <button className="rf-icon-btn" title="Logout" style={{ color: C.error }} onClick={onLogout}><LogOut size={16} /></button>
          </div>
        </header>

        <main style={{ padding: 28, maxWidth: 1440, width: "100%", margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>{title}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.sub }}>{subtitle}</p>
          </div>
          {loaded ? screens[page] : <div style={{ padding: 40, textAlign: "center", color: C.sub, fontSize: 13.5 }}>Loading live data…</div>}
        </main>
      </div>

      {drawerGift && <GiftDrawer gift={drawerGift} close={() => setDrawerGiftId(null)} onSetStatus={setGiftStatus} />}
    </div>
  );
}
