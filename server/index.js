require('dotenv').config();
// Patches Express so a rejected promise inside an `async (req, res) => {...}` route handler is
// forwarded to Express's error handling instead of being silently unhandled — without this, a
// bug in any one of this file's ~50 async routes hangs that request forever (no response ever
// sent) rather than returning a fast error. Must be required before express itself.
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const otplib = require('otplib');
const qrcode = require('qrcode');
const db = require('./db');

const PORT = process.env.PORT || 4100;

// Dev-only defaults: the two Vite/live-server dev ports, the Capacitor WebView's fixed origins
// (https:// on Android, capacitor:// on iOS — see EventX-mobile-latest/capacitor.config.json,
// which has no custom server.url so these stock ones apply), and the LAN IP the mobile app is
// currently pointed at (EventX-mobile-latest/www/config.js). No production domain exists yet —
// set ALLOWED_ORIGINS (comma-separated) to override this list once one does.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5180',
  'https://localhost', 'capacitor://localhost', 'ionic://localhost',
  'http://192.168.1.8:5173', 'http://192.168.1.8:5180',
];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;
const corsOptions = {
  // No Origin header (native/server-to-server/curl) is allowed through — bearer-token auth means
  // there's no ambient-credential (cookie) risk from that; an unrecognized browser Origin is not.
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
};

// Reuses the same Firebase project/credentials as EventX-mobile-latest/server (copy of its
// firebase-service-account.json) so campaign pushes land on the same devices the app's own
// reminder/SOS pushes already reach — no separate app registration needed.
let messaging = null;
try {
  const serviceAccount = require('./firebase-service-account.json');
  const fbApp = admin.initializeApp({ credential: admin.cert(serviceAccount) });
  messaging = getMessaging(fbApp);
} catch (err) {
  console.warn('Push notifications disabled:', err.message);
}

// Distinct channel from the app's own REMINDER_CHANNEL_ID/SOS_CHANNEL_ID (see
// EventX-mobile-latest/www/index.html initLocalNotifications) so an admin campaign push plays
// its own sound instead of the reminder beep or SOS alarm. Like that file's sos_alert.mp3, the
// actual audio asset (android/app/src/main/res/raw/admin_alert.mp3) still needs to be dropped
// into the native build for the sound to play — until then Android falls back to the channel's
// default sound, silently.
const ADMIN_PUSH_CHANNEL_ID = 'admin-campaign-alert';

// Quiet hours: 10 PM–6 AM IST. An immediate "Send Now" broadcast is deferred rather than waking
// every recipient's phone; an admin-scheduled campaign (runDueScheduledNotifications) is exempt
// since the admin explicitly chose that delivery time — quiet hours or not, it fires when asked.
function isQuietHours() {
  const hourPart = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).formatToParts(new Date()).find((p) => p.type === 'hour');
  const hour = hourPart ? parseInt(hourPart.value, 10) % 24 : new Date().getHours();
  return hour >= 22 || hour < 6;
}

async function sendPush(pushToken, { title, body, allowQuietHours }) {
  if (!messaging || !pushToken) return { ok: false, reason: !messaging ? 'messaging-disabled' : 'no-token' };
  if (!allowQuietHours && isQuietHours()) return { ok: false, reason: 'quiet-hours' };
  try {
    await messaging.send({
      token: pushToken,
      notification: { title, body },
      // priority: 'high' asks FCM/the device to wake up and deliver immediately rather than
      // batching it for the next Doze-mode maintenance window — matters for a closed/backgrounded
      // app the same way it does for the mobile server's own sendPush() (see EventX-mobile-latest
      // server/src/config/firebase.js).
      android: { priority: 'high', notification: { channelId: ADMIN_PUSH_CHANNEL_ID, sound: 'admin_alert' } },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// Phone push for a referral reward decision, so the person finds out even when the app is closed (the
// in-app notification row is written separately by the db layer). Same wording as that row. Best-effort
// and never awaited by the request: a missing token or push failure must not affect the admin's action.
function pushReferralUpdate(row, kind) {
  (async () => {
    const token = await db.findUserPushToken(row.referrer_user_id);
    const n = db.referralNotice(row, kind);
    await sendPush(token, { title: n.title, body: n.body, allowQuietHours: true });
  })().catch((err) => console.error('Referral push failed (non-blocking):', err.message));
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection (server stayed up):', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception (server stayed up):', err));

const app = express();
app.use(cors(corsOptions));
// Higher than the default — ad creatives are sent as base64 data URLs (see AdsScreen's image
// upload in the web app), same tradeoff the mobile server makes for event cover photos.
app.use(express.json({ limit: '15mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many attempts. Please wait a while and try again.' },
});

function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return 'Unknown device';
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  return `${os} · ${browser}`;
}

async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const admin = token ? await db.findAdminByToken(token) : null;
  if (!admin) return res.status(401).json({ ok: false, error: 'Invalid or expired admin session' });
  req.admin = admin;
  next();
}

// Every module a screen can access maps to a MENU id (see db.js MENU_IDS) — Super Admins
// (access_all) pass everything; others need that id in their access array. Login/logout and
// "who am I" are always allowed once authenticated, regardless of granted screens.
function requireAccess(moduleId) {
  return (req, res, next) => {
    if (req.admin.access_all) return next();
    const access = Array.isArray(req.admin.access) ? req.admin.access : [];
    if (access.includes(moduleId)) return next();
    return res.status(403).json({ ok: false, error: `No access to ${moduleId}` });
  };
}

function audit(action, module) {
  return (req, res, next) => {
    db.logAudit({ adminId: req.admin?.id, action, module, ip: req.ip, device: describeDevice(req.headers['user-agent']) }).catch((err) => console.error('audit log failed:', err.message));
    next();
  };
}

/* ─────────────────────────── Auth ─────────────────────────── */

// Bridges the password step to the TOTP step: a tempToken proves "this request already presented
// a correct password for this admin" without yet being a real session. 'enroll' also carries the
// freshly-generated secret so it never has to touch the database until the admin proves they can
// produce a code from it — an abandoned setup leaves no secret behind. 5-minute TTL, single use,
// swept on each request rather than run on a timer (this table stays tiny).
const pendingTfa = new Map();
const TFA_PENDING_TTL_MS = 5 * 60 * 1000;
function sweepPendingTfa() {
  const now = Date.now();
  for (const [key, entry] of pendingTfa) if (now > entry.expiresAt) pendingTfa.delete(key);
}

app.post('/api/admin/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });
  const row = await db.findAdminByEmail(email);
  if (!row || !db.verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }

  if (row.tfa_enabled) {
    sweepPendingTfa();
    const tempToken = crypto.randomBytes(24).toString('hex');
    if (!row.tfa_secret) {
      const secret = await otplib.generateSecret({});
      const otpauthUrl = otplib.generateURI({ issuer: 'Relfam Admin', label: row.email, secret });
      pendingTfa.set(tempToken, { adminId: row.id, purpose: 'enroll', secret, attempts: 0, expiresAt: Date.now() + TFA_PENDING_TTL_MS });
      const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
      return res.json({ ok: true, tfaSetupRequired: true, tempToken, secret, otpauthUrl, qrDataUrl });
    }
    pendingTfa.set(tempToken, { adminId: row.id, purpose: 'verify', attempts: 0, expiresAt: Date.now() + TFA_PENDING_TTL_MS });
    return res.json({ ok: true, tfaRequired: true, tempToken });
  }

  const token = await db.createAdminSession(row.id, { ip: req.ip, deviceLabel: describeDevice(req.headers['user-agent']) });
  await db.logAudit({ adminId: row.id, action: 'Logged in', module: 'Auth', ip: req.ip, device: describeDevice(req.headers['user-agent']) });
  res.json({ ok: true, token, admin: db.toPublicAdmin(row) });
});

app.post('/api/admin/auth/tfa/verify', authLimiter, async (req, res) => {
  const { tempToken, code } = req.body || {};
  const entry = tempToken ? pendingTfa.get(tempToken) : null;
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) pendingTfa.delete(tempToken);
    return res.status(400).json({ ok: false, error: 'Login has expired, please sign in again' });
  }

  const row = await db.findAdminById(entry.adminId);
  const secret = entry.purpose === 'enroll' ? entry.secret : row?.tfa_secret;
  const valid = row && secret && otplib.verifySync({ secret, token: String(code || '').trim() }).valid;

  if (!valid) {
    entry.attempts += 1;
    if (entry.attempts >= 5) {
      pendingTfa.delete(tempToken);
      return res.status(400).json({ ok: false, error: 'Too many incorrect attempts. Please sign in again.' });
    }
    return res.status(400).json({ ok: false, error: 'Incorrect code' });
  }

  pendingTfa.delete(tempToken);
  if (entry.purpose === 'enroll') await db.setAdminTfaSecret(row.id, secret);

  const token = await db.createAdminSession(row.id, { ip: req.ip, deviceLabel: describeDevice(req.headers['user-agent']) });
  await db.logAudit({ adminId: row.id, action: 'Logged in', module: 'Auth', ip: req.ip, device: describeDevice(req.headers['user-agent']) });
  res.json({ ok: true, token, admin: db.toPublicAdmin(row) });
});

app.post('/api/admin/auth/logout', requireAdminAuth, async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  await db.deleteAdminSession(token);
  res.json({ ok: true });
});

app.get('/api/admin/auth/me', requireAdminAuth, (req, res) => {
  res.json({ ok: true, admin: db.toPublicAdmin(req.admin) });
});

/* ─────────────────────────── Dashboard ─────────────────────────── */

app.get('/api/admin/dashboard', requireAdminAuth, requireAccess('dashboard'), async (req, res) => {
  const [kpis, series] = await Promise.all([db.getDashboardKpis(), db.getMonthlySeries()]);
  res.json({ ok: true, kpis, series });
});

/* ─────────────────────────── Notifications ─────────────────────────── */

// The "Specific users" picker (UserMultiSelect, including its bulk-paste box) can hand back up to
// 10,000 ids client-side, but nothing enforced that — or even that the array held real integers —
// on this side. Keeps only positive integers, dedupes, and caps at the same limit the UI itself
// advertises, so a malformed or oversized array fails cleanly instead of reaching the DB query.
const MAX_TARGET_USER_IDS = 10000;
function sanitizeTargetUserIds(raw) {
  if (!Array.isArray(raw)) return undefined;
  const ids = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  return ids.slice(0, MAX_TARGET_USER_IDS);
}

app.post('/api/admin/notifications/broadcast', requireAdminAuth, requireAccess('notifications'), audit('Sent push campaign', 'Notifications'), async (req, res) => {
  const { title, body, audience, targetStates, targetDistricts } = req.body || {};
  const targetUserIds = sanitizeTargetUserIds(req.body?.targetUserIds);
  if (!title || !body) return res.status(400).json({ ok: false, error: 'title and body are required' });
  if (!messaging) return res.status(503).json({ ok: false, error: 'Push notifications are disabled on the server — firebase-service-account.json is missing.' });
  // Broadcast campaigns have no in-app fallback (unlike the app's own family/task notifications,
  // which always land in the bell icon) — a push suppressed here would just vanish with no trace
  // for the recipient, so this rejects outright with a clear reason instead of silently sending 0,
  // rather than quietly dropping it the way an individual family notification's push does.
  if (isQuietHours()) return res.status(409).json({ ok: false, error: 'It\'s currently quiet hours (10 PM–6 AM IST) — sending now would notify everyone overnight. Use "Schedule" to pick a delivery time instead, or send after 6 AM.' });
  const recipients = await db.listPushTokensForAudience(audience || 'All users', { userIds: targetUserIds, states: targetStates, districts: targetDistricts });
  const results = await Promise.all(recipients.map((r) => sendPush(r.push_token, { title, body })));
  const sent = results.filter((r) => r.ok).length;
  res.json({ ok: true, total: recipients.length, sent, failed: recipients.length - sent });
});

app.post('/api/admin/notifications/schedule', requireAdminAuth, requireAccess('notifications'), audit('Scheduled push campaign', 'Notifications'), async (req, res) => {
  const { title, body, audience, targetStates, targetDistricts, scheduledAt } = req.body || {};
  const targetUserIds = sanitizeTargetUserIds(req.body?.targetUserIds);
  if (!title || !body) return res.status(400).json({ ok: false, error: 'title and body are required' });
  const when = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(when.getTime())) return res.status(400).json({ ok: false, error: 'A valid scheduledAt date/time is required' });
  if (when.getTime() <= Date.now()) return res.status(400).json({ ok: false, error: 'Scheduled time must be in the future' });
  const row = await db.createScheduledNotification({ title, body, audience, targetUserIds, targetStates, targetDistricts, scheduledAt: when.toISOString(), adminId: req.admin.id });
  res.json({ ok: true, scheduled: row });
});

app.get('/api/admin/notifications/scheduled', requireAdminAuth, requireAccess('notifications'), async (req, res) => {
  res.json({ ok: true, scheduled: await db.listScheduledNotifications() });
});

app.delete('/api/admin/notifications/scheduled/:id', requireAdminAuth, requireAccess('notifications'), audit('Cancelled scheduled push campaign', 'Notifications'), async (req, res) => {
  const row = await db.cancelScheduledNotification(Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, error: 'Not found, or already sent' });
  res.json({ ok: true });
});

// This server has no separate worker/cron process, so a scheduled campaign is only ever actually
// sent by this same long-running process polling its own table every 30s — good enough for an
// admin tool at this scale. Since the query is `scheduled_at <= now()` rather than an exact-time
// match, a send due while the server happened to be restarting still fires as soon as it's back
// up (just later than scheduled) rather than being silently skipped.
async function runDueScheduledNotifications() {
  let due;
  try {
    due = await db.listDueScheduledNotifications();
  } catch (err) {
    console.error('Failed to poll scheduled notifications:', err.message);
    return;
  }
  for (const sn of due) {
    try {
      if (!messaging) throw new Error('Push notifications are disabled on the server');
      const recipients = await db.listPushTokensForAudience(sn.audience, { userIds: sn.target_user_ids, states: sn.target_states, districts: sn.target_districts });
      const results = await Promise.all(recipients.map((r) => sendPush(r.push_token, { title: sn.title, body: sn.body, allowQuietHours: true })));
      const sent = results.filter((r) => r.ok).length;
      await db.markScheduledNotificationSent(sn.id, sent, recipients.length - sent);
      await db.logAudit({ adminId: sn.created_by_admin_id, action: `Scheduled push campaign sent (${sent}/${recipients.length})`, module: 'Notifications' });
    } catch (err) {
      console.error('Scheduled notification', sn.id, 'failed:', err.message);
      await db.markScheduledNotificationFailed(sn.id, err.message).catch(() => {});
    }
  }
}

/* ─────────────────────────── Users ─────────────────────────── */

app.get('/api/admin/users', requireAdminAuth, requireAccess('users'), async (req, res) => {
  const search = req.query.q ? String(req.query.q).trim() : '';
  const filter = req.query.filter ? String(req.query.filter).trim() : '';
  const page = Math.max(0, Number(req.query.page) || 0);
  const [users, total] = await Promise.all([
    db.listUsers({ search, filter, page }),
    db.countUsers({ search, filter }),
  ]);
  res.json({ ok: true, users, total, page });
});

app.get('/api/admin/users/:id', requireAdminAuth, requireAccess('users'), async (req, res) => {
  const user = await db.getUserDetail(Number(req.params.id));
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  res.json({ ok: true, user });
});

app.patch('/api/admin/users/:id/status', requireAdminAuth, requireAccess('users'), audit('Changed user status', 'Users'), async (req, res) => {
  const { status } = req.body || {};
  if (!['Active', 'Suspended', 'Blocked'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });
  const row = await db.setUserStatus(Number(req.params.id), status);
  if (!row) return res.status(404).json({ ok: false, error: 'User not found' });
  res.json({ ok: true, user: row });
});

/* ─────────────────────────── Events ─────────────────────────── */

app.get('/api/admin/events', requireAdminAuth, requireAccess('events'), async (req, res) => {
  res.json({ ok: true, events: await db.listEvents() });
});

/* ─────────────────────────── Gifts ─────────────────────────── */

app.get('/api/admin/gifts', requireAdminAuth, requireAccess('gifts'), async (req, res) => {
  res.json({ ok: true, gifts: await db.listGifts({ search: req.query.q }) });
});

app.patch('/api/admin/gifts/:ownerUserId/:clientId/status', requireAdminAuth, requireAccess('gifts'), audit('Changed gift status', 'Gift Records'), async (req, res) => {
  const { status } = req.body || {};
  const row = await db.setGiftStatus(Number(req.params.ownerUserId), Number(req.params.clientId), status);
  if (!row) return res.status(404).json({ ok: false, error: 'Gift record not found' });
  res.json({ ok: true, gift: row });
});

/* ─────────────────────────── Families ─────────────────────────── */

app.get('/api/admin/families', requireAdminAuth, requireAccess('families'), async (req, res) => {
  const search = req.query.q ? String(req.query.q).trim() : '';
  const page = Math.max(0, Number(req.query.page) || 0);
  const [families, total] = await Promise.all([
    db.listFamilies({ search, page }),
    db.countFamilies({ search }),
  ]);
  res.json({ ok: true, families, total, page });
});

app.delete('/api/admin/families/member/:id', requireAdminAuth, requireAccess('families'), audit('Removed family member', 'Family Accounts'), async (req, res) => {
  await db.removeFamilyMember(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/families/:primaryUserId/members', requireAdminAuth, requireAccess('families'), audit('Added family member', 'Family Accounts'), async (req, res) => {
  const { name, mobile, relation } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
  res.json({ ok: true, member: await db.addFamilyMember(Number(req.params.primaryUserId), { name, mobile, relation }) });
});

/* ─────────────────────────── Packages & subscriptions ─────────────────────────── */

app.get('/api/admin/packages', requireAdminAuth, requireAccess('payments'), async (req, res) => {
  res.json({ ok: true, packages: await db.listPackages() });
});

app.patch('/api/admin/packages/:id', requireAdminAuth, requireAccess('payments'), audit('Updated package', 'Packages & Payments'), async (req, res) => {
  const row = await db.updatePackage(req.params.id, req.body || {});
  res.json({ ok: true, package: row });
});

app.get('/api/admin/subscriptions', requireAdminAuth, requireAccess('payments'), async (req, res) => {
  res.json({ ok: true, subscriptions: await db.listSubscriptions() });
});

app.post('/api/admin/subscriptions', requireAdminAuth, requireAccess('payments'), audit('Created subscription', 'Packages & Payments'), async (req, res) => {
  const { userId, packageId, amount, method } = req.body || {};
  if (!userId || !packageId) return res.status(400).json({ ok: false, error: 'userId and packageId are required' });
  res.json({ ok: true, subscription: await db.createSubscription({ userId, packageId, amount, method }) });
});

app.patch('/api/admin/subscriptions/:id/status', requireAdminAuth, requireAccess('payments'), audit('Changed subscription status', 'Packages & Payments'), async (req, res) => {
  const row = await db.updateSubscriptionStatus(Number(req.params.id), req.body?.status);
  if (!row) return res.status(404).json({ ok: false, error: 'Subscription not found' });
  res.json({ ok: true, subscription: row });
});

/* ─────────────────────────── Feedback ─────────────────────────── */

app.get('/api/admin/feedback', requireAdminAuth, requireAccess('feedback'), async (req, res) => {
  res.json({ ok: true, feedback: await db.listFeedback({ status: req.query.status, rating: req.query.rating }) });
});

app.patch('/api/admin/feedback/:id/status', requireAdminAuth, requireAccess('feedback'), audit('Updated feedback status', 'Feedback'), async (req, res) => {
  const row = await db.updateFeedbackStatus(Number(req.params.id), req.body?.status);
  if (!row) return res.status(404).json({ ok: false, error: 'Feedback not found' });
  res.json({ ok: true, feedback: row });
});

/* ─────────────────────────── Referral payouts ─────────────────────────── */

app.get('/api/admin/referral-rewards', requireAdminAuth, requireAccess('referrals'), async (req, res) => {
  res.json({ ok: true, rewards: await db.listReferralRewards({ status: req.query.status }) });
});

app.get('/api/admin/referral-summary', requireAdminAuth, requireAccess('referrals'), async (req, res) => {
  res.json({ ok: true, ...(await db.getReferralSummary()) });
});

/* ─────────────────────────── Feature interest ("Coming soon" tiles) ─────────────────────────── */

app.get('/api/admin/feature-interest', requireAdminAuth, requireAccess('interest'), async (req, res) => {
  res.json({ ok: true, ...(await db.getFeatureInterest()) });
});

app.patch('/api/admin/referral-rewards/:id', requireAdminAuth, requireAccess('referrals'), audit('Reviewed referral reward', 'Referrals'), async (req, res) => {
  const status = req.body?.status;
  if (!['paid', 'rejected'].includes(status)) return res.status(400).json({ ok: false, error: 'Status must be paid or rejected' });
  const note = String(req.body?.note || '').trim().slice(0, 200);
  if (status === 'rejected' && !note) return res.status(400).json({ ok: false, error: 'Add a short reason so the user knows why' });
  // A payout has to be traceable to a real bank/UPI movement: the transaction reference (UTR) is required.
  const reference = String(req.body?.reference || '').trim().slice(0, 60);
  if (status === 'paid' && reference.length < 4) return res.status(400).json({ ok: false, error: 'Enter the payment reference (UPI transaction / UTR number) of the payment you made' });
  const row = await db.reviewReferralReward(Number(req.params.id), status, note, reference);
  if (!row) return res.status(404).json({ ok: false, error: 'This reward is no longer waiting for review' });
  pushReferralUpdate(row, status);
  res.json({ ok: true, reward: row });
});

// Undo a wrongly rejected reward: back into the awaiting-payout queue. The reason for reopening is required
// and goes into the audit log (with the reward, the amount and what the rejection had said), so there is
// always a record of who reversed a decision and why.
app.post('/api/admin/referral-rewards/:id/reopen', requireAdminAuth, requireAccess('referrals'), async (req, res) => {
  const note = String(req.body?.note || '').trim().slice(0, 200);
  if (note.length < 4) return res.status(400).json({ ok: false, error: 'Add a short reason for reopening — it is kept in the audit log' });
  const row = await db.reopenReferralReward(Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, error: 'Only a rejected reward can be reopened' });
  await db.logAudit({
    adminId: req.admin?.id,
    action: `Reopened referral reward #${row.id} (₹${row.amount}) — reason: ${note}${row.prior_rejection_note ? ` — earlier rejection: ${row.prior_rejection_note}` : ''}`,
    module: 'Referrals', ip: req.ip, device: describeDevice(req.headers['user-agent']),
  }).catch((err) => console.error('audit log failed:', err.message));
  pushReferralUpdate(row, 'reopened');
  res.json({ ok: true, reward: row });
});

/* ─────────────────────────── Fraud ─────────────────────────── */

app.get('/api/admin/fraud-cases', requireAdminAuth, requireAccess('fraud'), async (req, res) => {
  res.json({ ok: true, cases: await db.listFraudCases() });
});

app.post('/api/admin/fraud-cases', requireAdminAuth, requireAccess('fraud'), audit('Created fraud case', 'Fraud & Spam'), async (req, res) => {
  const { userId, type, severity, evidence, signal } = req.body || {};
  if (!userId || !type) return res.status(400).json({ ok: false, error: 'userId and type are required' });
  res.json({ ok: true, case: await db.createFraudCase({ userId, type, severity, evidence, signal }) });
});

app.patch('/api/admin/fraud-cases/:id/status', requireAdminAuth, requireAccess('fraud'), audit('Changed fraud case status', 'Fraud & Spam'), async (req, res) => {
  const row = await db.updateFraudStatus(Number(req.params.id), req.body?.status);
  if (!row) return res.status(404).json({ ok: false, error: 'Case not found' });
  res.json({ ok: true, case: row });
});

app.post('/api/admin/fraud-cases/scan', requireAdminAuth, requireAccess('fraud'), audit('Ran fraud scan', 'Fraud & Spam'), async (req, res) => {
  const created = await db.scanForFraud();
  res.json({ ok: true, found: created.length, cases: created });
});

/* ─────────────────────────── Support tickets ─────────────────────────── */

app.get('/api/admin/tickets', requireAdminAuth, requireAccess('support'), async (req, res) => {
  res.json({ ok: true, tickets: await db.listTickets() });
});

app.post('/api/admin/tickets', requireAdminAuth, requireAccess('support'), audit('Created ticket', 'Support'), async (req, res) => {
  const { userId, category, priority, assignedAdminId, description } = req.body || {};
  if (!userId || !category) return res.status(400).json({ ok: false, error: 'userId and category are required' });
  res.json({ ok: true, ticket: await db.createTicket({ userId, category, priority, assignedAdminId, description }) });
});

app.patch('/api/admin/tickets/:id', requireAdminAuth, requireAccess('support'), audit('Updated ticket', 'Support'), async (req, res) => {
  const row = await db.updateTicket(Number(req.params.id), req.body || {});
  if (!row) return res.status(404).json({ ok: false, error: 'Ticket not found' });
  res.json({ ok: true, ticket: row });
});

/* ─────────────────────────── Ads ─────────────────────────── */

app.get('/api/admin/ads', requireAdminAuth, requireAccess('ads'), async (req, res) => {
  res.json({ ok: true, ads: await db.listAds() });
});

app.post('/api/admin/ads', requireAdminAuth, requireAccess('ads'), audit('Created ad', 'Advertisements'), async (req, res) => {
  if (!req.body?.title) return res.status(400).json({ ok: false, error: 'title is required' });
  res.json({ ok: true, ad: await db.createAd(req.body) });
});

app.patch('/api/admin/ads/:id/status', requireAdminAuth, requireAccess('ads'), audit('Changed ad status', 'Advertisements'), async (req, res) => {
  const row = await db.updateAdStatus(Number(req.params.id), req.body?.status);
  if (!row) return res.status(404).json({ ok: false, error: 'Ad not found' });
  res.json({ ok: true, ad: row });
});

app.delete('/api/admin/ads/:id', requireAdminAuth, requireAccess('ads'), audit('Deleted ad', 'Advertisements'), async (req, res) => {
  await db.deleteAd(Number(req.params.id));
  res.json({ ok: true });
});

/* ─────────────────────────── Content: FAQs & announcements ─────────────────────────── */

app.get('/api/admin/faqs', requireAdminAuth, requireAccess('content'), async (req, res) => {
  res.json({ ok: true, faqs: await db.listFaqs() });
});
app.post('/api/admin/faqs', requireAdminAuth, requireAccess('content'), audit('Added FAQ', 'Content Management'), async (req, res) => {
  if (!req.body?.title) return res.status(400).json({ ok: false, error: 'title is required' });
  res.json({ ok: true, faq: await db.createFaq(req.body) });
});
app.patch('/api/admin/faqs/:id/toggle', requireAdminAuth, requireAccess('content'), audit('Toggled FAQ published', 'Content Management'), async (req, res) => {
  res.json({ ok: true, faq: await db.toggleFaqPublished(Number(req.params.id)) });
});
app.delete('/api/admin/faqs/:id', requireAdminAuth, requireAccess('content'), audit('Deleted FAQ', 'Content Management'), async (req, res) => {
  await db.deleteFaq(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/announcements', requireAdminAuth, requireAccess('content'), async (req, res) => {
  res.json({ ok: true, announcements: await db.listAnnouncements() });
});
app.post('/api/admin/announcements', requireAdminAuth, requireAccess('content'), audit('Published announcement', 'Content Management'), async (req, res) => {
  if (!req.body?.title) return res.status(400).json({ ok: false, error: 'title is required' });
  res.json({ ok: true, announcement: await db.createAnnouncement(req.body) });
});
app.patch('/api/admin/announcements/:id/toggle', requireAdminAuth, requireAccess('content'), audit('Toggled announcement', 'Content Management'), async (req, res) => {
  res.json({ ok: true, announcement: await db.toggleAnnouncementActive(Number(req.params.id)) });
});
app.delete('/api/admin/announcements/:id', requireAdminAuth, requireAccess('content'), audit('Deleted announcement', 'Content Management'), async (req, res) => {
  await db.deleteAnnouncement(Number(req.params.id));
  res.json({ ok: true });
});

/* ─────────────────────────── Settings ─────────────────────────── */

app.get('/api/admin/settings', requireAdminAuth, requireAccess('settings'), async (req, res) => {
  res.json({ ok: true, settings: await db.getSettings() });
});
app.patch('/api/admin/settings/:key', requireAdminAuth, requireAccess('settings'), audit('Updated settings', 'Settings'), async (req, res) => {
  res.json({ ok: true, value: await db.updateSetting(req.params.key, req.body) });
});

/* ─────────────────────────── Backups ───────────────────────────
   The Settings > Backup screen used to just be a label an admin could set to "Just now" by hand —
   nothing on this side ever actually dumped the database. This makes it real: an on-demand route
   for "Mark backed up now", and a poller (mirroring runDueScheduledNotifications' own pattern —
   this server has no separate cron/worker process) that fires pg_dump on its own once the chosen
   Frequency has elapsed since the last one, whenever Auto backup is on. */
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
// Checked in this order: an explicit override, then the two PostgreSQL installs actually present
// on this machine (server_version 18.6 is what `relfam` itself runs on — pg_dump is generally
// backward-compatible with an older server but not guaranteed forward-compatible with a newer
// one, so the matching major-version binary is tried first), then whatever's on PATH.
function resolvePgDumpBin() {
  const candidates = [
    process.env.PG_DUMP_PATH,
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'pg_dump';
}

function runDatabaseBackup(trigger) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `relfam-${stamp}.sql`;
    const outPath = path.join(BACKUP_DIR, filename);
    const bin = resolvePgDumpBin();
    const args = [
      '-h', process.env.PGHOST || '127.0.0.1',
      '-p', String(Number(process.env.PGPORT) || 5432),
      '-U', process.env.PGUSER || 'postgres',
      '-d', process.env.PGDATABASE || 'relfam',
      '-F', 'p',
      '-f', outPath,
    ];
    execFile(bin, args, { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD } }, async (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr?.trim() || err.message));
      }
      let sizeBytes = 0;
      try { sizeBytes = fs.statSync(outPath).size; } catch (e) { /* stat is best-effort */ }
      const current = (await db.getSettings()).backup || {};
      const last = new Date().toISOString();
      await db.updateSetting('backup', { ...current, last, lastFile: filename, lastTrigger: trigger, lastSizeBytes: sizeBytes });
      resolve({ file: filename, sizeBytes, last });
    });
  });
}

const BACKUP_FREQUENCY_MS = { Hourly: 60 * 60 * 1000, Daily: 24 * 60 * 60 * 1000, Weekly: 7 * 24 * 60 * 60 * 1000 };
async function runDueAutoBackup() {
  let backupSettings;
  try {
    backupSettings = (await db.getSettings()).backup;
  } catch (err) {
    console.error('Failed to read backup settings:', err.message);
    return;
  }
  if (!backupSettings?.auto) return;
  const intervalMs = BACKUP_FREQUENCY_MS[backupSettings.freq] || BACKUP_FREQUENCY_MS.Daily;
  const lastMs = backupSettings.last ? new Date(backupSettings.last).getTime() : 0;
  if (Date.now() - lastMs < intervalMs) return;
  try {
    const result = await runDatabaseBackup('auto');
    await db.logAudit({ adminId: null, action: `Automatic database backup completed (${result.file})`, module: 'Settings' });
  } catch (err) {
    console.error('Automatic backup failed:', err.message);
  }
}

app.post('/api/admin/backup/run', requireAdminAuth, requireAccess('settings'), audit('Ran manual database backup', 'Settings'), async (req, res) => {
  try {
    const result = await runDatabaseBackup('manual');
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ─────────────────────────── Admin management ─────────────────────────── */

app.get('/api/admin/admins', requireAdminAuth, requireAccess('admins'), async (req, res) => {
  res.json({ ok: true, admins: await db.listAdmins() });
});

app.post('/api/admin/admins', requireAdminAuth, requireAccess('admins'), audit('Added admin', 'Admin Management'), async (req, res) => {
  const { name, email, password, role, access, tfa } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ ok: false, error: 'name, email and password are required' });
  try {
    res.json({ ok: true, admin: await db.createAdmin({ name, email, password, role, access, tfa }) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'An admin with that email already exists' });
    throw err;
  }
});

app.patch('/api/admin/admins/:id', requireAdminAuth, requireAccess('admins'), audit('Updated admin access', 'Admin Management'), async (req, res) => {
  const row = await db.updateAdmin(Number(req.params.id), req.body || {});
  if (!row) return res.status(404).json({ ok: false, error: 'Admin not found' });
  res.json({ ok: true, admin: row });
});

app.patch('/api/admin/admins/:id/toggle-tfa', requireAdminAuth, requireAccess('admins'), audit('Toggled admin 2FA', 'Admin Management'), async (req, res) => {
  res.json({ ok: true, admin: await db.toggleAdminTfa(Number(req.params.id)) });
});

app.delete('/api/admin/admins/:id', requireAdminAuth, requireAccess('admins'), audit('Removed admin', 'Admin Management'), async (req, res) => {
  if (Number(req.params.id) === req.admin.id) return res.status(400).json({ ok: false, error: "You can't remove your own account" });
  await db.deleteAdmin(Number(req.params.id));
  res.json({ ok: true });
});

/* ─────────────────────────── Audit logs ─────────────────────────── */

app.get('/api/admin/audit-logs', requireAdminAuth, requireAccess('audit'), async (req, res) => {
  res.json({ ok: true, logs: await db.listAuditLogs() });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Catches anything express-async-errors forwards (a rejected promise from any route above) and
// answers with JSON instead of Express's default HTML error page — must be registered after
// every other app.use/app.get/etc.
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`Relfam Admin server listening on :${PORT}`));
    setInterval(runDueScheduledNotifications, 30000);
    runDueScheduledNotifications();
    // 5-minute granularity is plenty even for the "Hourly" option — a real backup landing a few
    // minutes late is harmless, and polling more often than that just burns cycles for no benefit.
    setInterval(runDueAutoBackup, 5 * 60000);
    runDueAutoBackup();
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
