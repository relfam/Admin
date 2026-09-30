// "Daily checks": the paid outside services Relfam depends on, pinned at the top of every admin screen until someone has
// looked at each one today (India time). Where the server can see a problem itself, it says so; where it cannot (a
// provider's balance, a card on file), the card links to the right page and the admin marks it checked.
//
//   msg91     SMS codes      sent / failed today, from service_usage (the app server counts every send) + last reason
//   resend    email codes    same; the free plan stops at 100 a day and 3,000 a month
//   namecheap domain + VPS   relfam.com's real expiry from the public .com registry (RDAP), the VPS renewal date the
//                            admin enters (no public source), and the HTTPS certificates' expiry on the live hosts
//   google    Maps / Places  lookups refused today (key blocked, quota, billing)
//
// Ticks and the VPS date live in app_settings under "dailyChecks". A problem found here (domain/VPS/certificate close to
// expiry, codes failing) is also sent once a day as an alert email (see runDailyAlert).
const tls = require('tls');
const db = require('./db');

const DOMAIN = process.env.DAILY_CHECK_DOMAIN || 'relfam.com';
const CERT_HOSTS = (process.env.DAILY_CHECK_CERT_HOSTS || 'api.relfam.com,admin.relfam.com').split(',').map((s) => s.trim()).filter(Boolean);
const EMAIL_DAILY_LIMIT = Number(process.env.RESEND_DAILY_LIMIT) || 100;   // Resend free plan
const EMAIL_MONTHLY_LIMIT = Number(process.env.RESEND_MONTHLY_LIMIT) || 3000;
const WARN_DAYS = 30, BAD_DAYS = 10;

const ITEMS = [
  { id: 'msg91', name: 'MSG91 — SMS codes', link: 'https://control.msg91.com/', linkLabel: 'Open MSG91',
    todo: 'Check the wallet / free credits and that the low-balance alert is on.' },
  { id: 'resend', name: 'Resend — email codes', link: 'https://resend.com/emails', linkLabel: 'Open Resend',
    todo: `Check usage: the free plan allows ${EMAIL_DAILY_LIMIT} emails a day and ${EMAIL_MONTHLY_LIMIT.toLocaleString('en-IN')} a month.` },
  { id: 'namecheap', name: 'Namecheap — domain & VPS', link: 'https://ap.www.namecheap.com/dashboard', linkLabel: 'Open Namecheap',
    todo: 'Check auto-renew is on for the domain and the VPS, and the payment card is valid.' },
  { id: 'google', name: 'Google Maps key', link: 'https://console.cloud.google.com/billing', linkLabel: 'Open Google Cloud',
    todo: 'Check billing is active and the Places / Geocoding APIs are enabled for the key.' },
];

const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysUntil = (iso) => (iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 86400000) : null);
const levelForDays = (d) => (d === null ? 'warn' : d <= BAD_DAYS ? 'bad' : d <= WARN_DAYS ? 'warn' : 'ok');
const worst = (...levels) => (levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : 'ok');

// ---- facts the server can find out for itself (cached: they change slowly and must not slow the admin down) ----
const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// The .com/.net registry's public RDAP record says when the domain expires — the same date Namecheap shows.
function domainExpiry() {
  return cached(`rdap:${DOMAIN}`, 12 * 3600 * 1000, async () => {
    try {
      const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(DOMAIN)}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { error: `registry answered ${res.status}` };
      const data = await res.json();
      const exp = (data.events || []).find((e) => e.eventAction === 'expiration');
      return exp ? { expires: exp.eventDate } : { error: 'no expiry date in the registry record' };
    } catch (err) { return { error: err.message }; }
  });
}

function certExpiry(host) {
  return cached(`cert:${host}`, 6 * 3600 * 1000, () => new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 10000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert && cert.valid_to ? { host, expires: new Date(cert.valid_to).toISOString() } : { host, error: 'no certificate' });
    });
    socket.on('timeout', () => { socket.destroy(); resolve({ host, error: 'timed out' }); });
    socket.on('error', (err) => resolve({ host, error: err.message }));
  }));
}

// service_usage is created by the app server (EventX-mobile-latest/server/db.js); until it has started once with that
// version the table may not exist, which is "no data yet", not an error.
async function usage(service) {
  try {
    const { rows } = await db.pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, ok, failed, last_error, last_error_at FROM service_usage
       WHERE service = $1 AND day > (now() AT TIME ZONE 'Asia/Kolkata')::date - 31 ORDER BY day DESC`, [service]);
    const today = rows.find((r) => r.day === todayIST()) || { ok: 0, failed: 0 };
    const sum = (list, f) => list.reduce((a, r) => a + r[f], 0);
    const week = rows.slice(0, 7);
    const lastErr = rows.find((r) => r.last_error);
    return {
      today: { ok: today.ok, failed: today.failed },
      week: { ok: sum(week, 'ok'), failed: sum(week, 'failed') },
      month: { ok: sum(rows, 'ok'), failed: sum(rows, 'failed') },
      lastError: lastErr ? { text: lastErr.last_error, at: lastErr.last_error_at } : null,
    };
  } catch (err) { return { unavailable: true }; }
}

// ---- one item each ----
function serviceItem(base, u, extra = {}) {
  if (u.unavailable) return { ...base, level: 'warn', facts: ['No usage data yet — the app server has not counted any sends.'] };
  const failedToday = u.today.failed;
  const done = extra.noun || 'sent';
  const facts = [
    `Today: ${u.today.ok} ${done}${failedToday ? `, ${failedToday} FAILED` : ''} · last 7 days: ${u.week.ok} ${done}${u.week.failed ? `, ${u.week.failed} failed` : ''}`,
    ...(extra.facts || []),
  ];
  if (u.lastError) facts.push(`Last failure (${new Date(u.lastError.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}): ${u.lastError.text}`);
  return { ...base, level: worst(failedToday ? 'bad' : 'ok', extra.level || 'ok'), facts };
}

async function items(settings) {
  const dc = settings.dailyChecks || {};
  const [sms, email, maps, domain, certs] = await Promise.all([
    usage('sms'), usage('email'), usage('maps'), domainExpiry(), Promise.all(CERT_HOSTS.map(certExpiry)),
  ]);
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  const emailToday = email.unavailable ? 0 : email.today.ok + email.today.failed;
  const emailMonth = email.unavailable ? 0 : email.month.ok;
  const emailLevel = emailToday >= EMAIL_DAILY_LIMIT || emailMonth >= EMAIL_MONTHLY_LIMIT ? 'bad'
    : emailToday >= EMAIL_DAILY_LIMIT * 0.8 || emailMonth >= EMAIL_MONTHLY_LIMIT * 0.8 ? 'warn' : 'ok';

  const domainDays = daysUntil(domain.expires);
  const vpsDays = daysUntil(dc.vpsRenewal);
  const nc = [
    domain.expires ? `${DOMAIN} expires ${new Date(domain.expires).toDateString()} (${domainDays} days)` : `${DOMAIN} expiry: could not read (${domain.error})`,
    dc.vpsRenewal ? `VPS renews ${new Date(dc.vpsRenewal).toDateString()} (${vpsDays} days)` : 'VPS renewal date not set yet — enter it below.',
    ...certs.map((c) => (c.expires ? `HTTPS ${c.host}: valid until ${new Date(c.expires).toDateString()} (${daysUntil(c.expires)} days, renews itself)` : `HTTPS ${c.host}: could not check (${c.error})`)),
  ];
  // Certificates renew themselves ~30 days before expiry, so fewer than 20 days left means renewal is not working.
  const certLevel = worst(...certs.map((c) => { if (!c.expires) return 'warn'; const d = daysUntil(c.expires); return d <= BAD_DAYS ? 'bad' : d <= 20 ? 'warn' : 'ok'; }));

  const list = [
    serviceItem(byId.msg91, sms),
    serviceItem(byId.resend, email, { level: emailLevel, facts: email.unavailable ? [] : [`This month: ${emailMonth} of ${EMAIL_MONTHLY_LIMIT.toLocaleString('en-IN')} · today ${emailToday} of ${EMAIL_DAILY_LIMIT}`] }),
    { ...byId.namecheap, level: worst(domain.expires ? levelForDays(domainDays) : 'warn', levelForDays(vpsDays), certLevel), facts: nc, vpsRenewal: dc.vpsRenewal || null },
    serviceItem(byId.google, maps, { noun: 'lookups worked' }),
  ];

  const marks = dc.marks || {};
  const today = todayIST();
  return list.map((i) => {
    const m = marks[i.id];
    return { ...i, checkedToday: !!(m && m.date === today), checkedBy: m ? m.by : null, checkedAt: m ? m.at : null };
  });
}

async function getDailyChecks() {
  const settings = await db.getSettings();
  const list = await items(settings);
  return { today: todayIST(), items: list, remaining: list.filter((i) => !i.checkedToday).length };
}

async function markChecked(itemId, adminName) {
  if (!ITEMS.some((i) => i.id === itemId)) throw Object.assign(new Error('Unknown check'), { status: 400 });
  const settings = await db.getSettings();
  const dc = settings.dailyChecks || {};
  dc.marks = { ...(dc.marks || {}), [itemId]: { date: todayIST(), by: adminName || 'Admin', at: new Date().toISOString() } };
  await db.updateSetting('dailyChecks', dc);
  return getDailyChecks();
}

async function setVpsRenewal(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || isNaN(new Date(date).getTime())) throw Object.assign(new Error('Enter the date as YYYY-MM-DD'), { status: 400 });
  const settings = await db.getSettings();
  await db.updateSetting('dailyChecks', { ...(settings.dailyChecks || {}), vpsRenewal: date });
  return getDailyChecks();
}

// Once a day (the alert key carries the date, and sendAlert's own cooldown stops repeats): an email listing whatever is
// red — codes failing, domain/VPS/certificate close to expiry — so it is noticed even on a day nobody opens the admin.
async function runDailyAlert(sendAlert) {
  try {
    const { items: list, today } = await getDailyChecks();
    const bad = list.filter((i) => i.level === 'bad');
    if (!bad.length) return false;
    const text = bad.map((i) => `• ${i.name}: ${i.facts.join(' | ')}`).join('\n');
    return await sendAlert(`daily-checks:${today}`, `Daily checks: ${bad.length} need attention`, `${text}\n\nOpen the admin app to see the details.`);
  } catch (err) { console.error('Daily checks alert failed:', err.message); return false; }
}

module.exports = { getDailyChecks, markChecked, setVpsRenewal, runDailyAlert, ITEMS };
