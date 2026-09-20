// Backups that are PROVEN restorable, retention, alerts, and a watchdog. "A backup file exists" proves nothing: what matters is that the
// database can be brought back from it. Every backup made here is checked, and regularly restored into a throw-away database and compared
// with the live one; if that ever fails, or the server goes down, or errors spike, an alert goes out.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('pg');
const dns = require('dns').promises;
const db = require('./db');

const cfg = {
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
  // A second location (another drive, a synced or network folder). A backup on the same disk as the database is lost with it.
  copyDir: process.env.BACKUP_COPY_DIR || '',
  // Keep the newest backup of each of the last N days, N weeks and N months; everything older is removed.
  policy: {
    daily: Number(process.env.BACKUP_KEEP_DAILY) || 14,
    weekly: Number(process.env.BACKUP_KEEP_WEEKLY) || 8,
    monthly: Number(process.env.BACKUP_KEEP_MONTHLY) || 6,
  },
  restoreEveryHours: Number(process.env.RESTORE_TEST_EVERY_HOURS) || 24,
  appHealthUrl: process.env.APP_HEALTH_URL || 'http://localhost:4000/health',
  watchdogEveryMs: Number(process.env.WATCHDOG_EVERY_MS) || 60000, // how often the app server is checked
  failuresToAlert: Number(process.env.WATCHDOG_FAILS) || 3, // failed checks in a row before "DOWN" is announced
  alertCooldownMs: 30 * 60000,
  dbConfig: () => ({
    host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD, database: process.env.PGDATABASE || 'relfam',
  }),
};
function configure(overrides) { Object.assign(cfg, overrides); if (overrides && overrides.policy) cfg.policy = { ...cfg.policy, ...overrides.policy }; }

// Tables whose row counts a restored copy is compared on. Anything that does not exist in this database is skipped.
const KEY_TABLES = ['users', 'user_data', 'events', 'gift_records', 'notifications', 'admins'];
// Row counts on the live database move while a dump is being taken, so a restored copy may differ by a few rows.
const countTolerance = (expected) => Math.max(3, Math.ceil(expected * 0.02));

/* ───────────── PostgreSQL tools ───────────── */
function pgBin(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const dirs = [process.env.PG_BIN_DIR, 'C:\\Program Files\\PostgreSQL\\18\\bin', 'C:\\Program Files\\PostgreSQL\\14\\bin'].filter(Boolean);
  for (const d of dirs) { const p = path.join(d, exe); if (fs.existsSync(p)) return p; }
  if (name === 'pg_dump' && process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) return process.env.PG_DUMP_PATH;
  return exe;
}
// Keeps only the file name of any path in a message (errors from the tools name full folders, which are not for screens or emails).
const scrub = (msg) => String(msg).replace(/(?:[A-Za-z]:)?[\\/](?:[^\s'"\\/:]+[\\/])+([^\s'"\\/:]+)/g, '$1');
function run(bin, args, options = {}) {
  const c = cfg.dbConfig();
  return new Promise((resolve, reject) => {
    execFile(bin, args, { env: { ...process.env, PGPASSWORD: c.password }, maxBuffer: 64 * 1024 * 1024, timeout: options.timeoutMs || 15 * 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(scrub(String(stderr || '').trim().split('\n').slice(-3).join(' ') || err.message)));
      resolve({ stdout, stderr });
    });
  });
}
const connArgs = () => { const c = cfg.dbConfig(); return ['-h', String(c.host), '-p', String(c.port), '-U', String(c.user)]; };

/* ───────────── alerts ───────────── */
const lastAlertAt = new Map();
async function readOps() { try { return (await db.getSettings()).ops || {}; } catch (err) { return {}; } }
async function writeOps(patch) { try { await db.updateSetting('ops', { ...(await readOps()), ...patch }); } catch (err) { /* settings unavailable */ } }
async function emailAlert(subject, text) {
  const key = process.env.RESEND_API_KEY, to = process.env.ALERT_EMAIL_TO;
  if (!key || !to) return { ok: false, error: 'email alerts are not set up (ALERT_EMAIL_TO and RESEND_API_KEY)' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM || 'Relfam Alerts <onboarding@resend.dev>', to: to.split(',').map((s) => s.trim()).filter(Boolean), subject: `[Relfam] ${subject}`, text }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: `the email service refused it (${res.status}${body && body.message ? ': ' + String(body.message).slice(0, 140) : ''})` };
  } catch (err) { console.error('Alert email failed:', err.message); return { ok: false, error: 'could not reach the email service: ' + err.message }; }
}
// One alert per problem per cooldown, so a long outage does not become a hundred emails. A key ending in ":recovered" is never throttled.
async function sendAlert(key, subject, text, options = {}) {
  const now = Date.now();
  if (!options.always && now - (lastAlertAt.get(key) || 0) < cfg.alertCooldownMs) return false;
  lastAlertAt.set(key, now);
  console.error(`ALERT: ${subject} — ${text}`);
  const result = { sent: true };
  const sent = options.sendEmail === false ? { ok: false } : await (cfg.emailer || emailAlert)(subject, text);
  const emailed = sent === true || !!(sent && sent.ok);
  const emailError = emailed || options.sendEmail === false ? '' : String((sent && sent.error) || 'not sent');
  const ops = await readOps();
  const alerts = [{ at: new Date(now).toISOString(), key, subject, text: String(text).slice(0, 400), emailed, ...(emailError ? { emailError } : {}) }, ...(ops.alerts || [])].slice(0, 30);
  await writeOps({ alerts });
  try { await db.logAudit({ adminId: null, action: `ALERT: ${subject}`, module: 'Monitoring' }); } catch (err) { /* audit is best-effort */ }
  lastAlertResult = { emailed, emailError };
  return true;
}
// What happened to the most recent alert's email, for the "Send test alert" button.
let lastAlertResult = { emailed: false, emailError: '' };
async function sendTestAlert() {
  await sendAlert('test-alert', 'Test alert', 'This is a test from the Relfam admin System Health screen. If you can read this, alert emails reach you.', { always: true });
  const mx = process.env.ALERT_EMAIL_TO ? await recipientCanReceive() : { ok: true };
  return { ...lastAlertResult, ...(mx.ok ? {} : { undeliverable: mx.reason }) };
}

// An email service will "accept" a message for any address; whether it can ever ARRIVE depends on the address's domain having a mail
// server (an MX record). A domain set up only for SENDING (like relfam.com through Resend) cannot receive: mail to it bounces. This checks that.
// Asks public DNS servers first (this computer's own resolver may still hold an old "no records" answer for a while after mail is set up),
// then this computer's resolver. Any answer with a mail server counts.
// One resolver per public server: right after mail is set up they can disagree for a while (each caches the old answer for a different time).
const publicResolvers = ['1.1.1.1', '8.8.8.8', '9.9.9.9'].map((ip) => { const r = new dns.Resolver(); r.setServers([ip]); return r; });
async function hasMailServer(domain) {
  let sawNone = false;
  for (const r of [...publicResolvers, dns]) {
    try { const mx = await r.resolveMx(domain); if (mx && mx.length) return { ok: true }; sawNone = true; }
    catch (err) { if (['ENODATA', 'ENOTFOUND', 'ENOTIMP'].includes(err.code)) sawNone = true; }
  }
  return sawNone ? { ok: false } : { ok: true, unchecked: true }; // no resolver answered at all: do not accuse the address
}
let mxCache = { key: '', at: 0, result: null };
async function recipientCanReceive(addresses = process.env.ALERT_EMAIL_TO) {
  const first = String(addresses || '').split(',')[0].trim();
  if (!first) return { ok: false, configured: false, reason: 'no alert address is set' };
  if (mxCache.key === first && Date.now() - mxCache.at < 10 * 60000) return mxCache.result;
  const domain = first.split('@')[1];
  let result;
  if (!domain || !domain.includes('.')) result = { ok: false, configured: true, address: first, reason: `${first} is not a valid email address` };
  else {
    const found = await hasMailServer(domain);
    result = found.ok ? { ok: true, configured: true, address: first, ...(found.unchecked ? { unchecked: true } : {}) }
      : { ok: false, configured: true, address: first, reason: `${domain} has no mail server set up (no MX records), so email sent to ${first} cannot be delivered` };
  }
  mxCache = { key: first, at: Date.now(), result };
  return result;
}

/* ───────────── retention ───────────── */
const FILE_RE = /^relfam-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.sql$/;
function parseStamp(name) {
  const m = FILE_RE.exec(name); if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]));
}
const weekKey = (d) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
// Which backups to keep: the newest of each of the last `daily` days, `weekly` weeks and `monthly` months, and always the newest overall.
// Files whose names are not ours are never touched.
function pickBackupsToKeep(names, policy = cfg.policy) {
  const items = names.map((n) => ({ n, d: parseStamp(n) })).filter((x) => x.d).sort((a, b) => b.d - a.d);
  const keep = new Set();
  if (items[0]) keep.add(items[0].n);
  const days = new Set(), weeks = new Set(), months = new Set();
  for (const { n, d } of items) {
    const dk = d.toISOString().slice(0, 10), wk = weekKey(d), mk = d.toISOString().slice(0, 7);
    if (!days.has(dk)) { days.add(dk); if (days.size <= policy.daily) keep.add(n); }
    if (!weeks.has(wk)) { weeks.add(wk); if (weeks.size <= policy.weekly) keep.add(n); }
    if (!months.has(mk)) { months.add(mk); if (months.size <= policy.monthly) keep.add(n); }
  }
  return { keep: items.filter((x) => keep.has(x.n)).map((x) => x.n), remove: items.filter((x) => !keep.has(x.n)).map((x) => x.n) };
}
function pruneBackups(dir, policy = cfg.policy) {
  let names = []; try { names = fs.readdirSync(dir); } catch (err) { return []; }
  const { remove } = pickBackupsToKeep(names, policy);
  for (const n of remove) { try { fs.unlinkSync(path.join(dir, n)); } catch (err) { console.error('Could not remove old backup', n, err.message); } }
  return remove;
}
function listBackups(dir = cfg.backupDir) {
  let names = []; try { names = fs.readdirSync(dir); } catch (err) { return []; }
  return names.filter((n) => FILE_RE.test(n)).map((n) => { const st = fs.statSync(path.join(dir, n)); return { name: n, sizeBytes: st.size, at: parseStamp(n).toISOString() }; }).sort((a, b) => b.at.localeCompare(a.at));
}

/* ───────────── is the file a complete dump? ───────────── */
function verifyDump(file) {
  try {
    const st = fs.statSync(file);
    if (st.size < 200) return { ok: false, reason: `the file is only ${st.size} bytes` };
    const fd = fs.openSync(file, 'r');
    try {
      const head = Buffer.alloc(Math.min(4096, st.size)), tail = Buffer.alloc(Math.min(4096, st.size));
      fs.readSync(fd, head, 0, head.length, 0); fs.readSync(fd, tail, 0, tail.length, st.size - tail.length);
      if (!head.toString('utf8').includes('PostgreSQL database dump')) return { ok: false, reason: 'it does not start like a database dump' };
      if (!tail.toString('utf8').includes('PostgreSQL database dump complete')) return { ok: false, reason: 'it is cut short (no end-of-dump marker): the backup did not finish' };
    } finally { fs.closeSync(fd); }
    return { ok: true, sizeBytes: st.size };
  } catch (err) { return { ok: false, reason: err.message }; }
}

/* ───────────── restore test ───────────── */
async function tableCounts(client, wanted) {
  const have = new Set((await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)", [wanted])).rows.map((r) => r.table_name));
  const out = {};
  for (const t of wanted) if (have.has(t)) out[t] = (await client.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n;
  return out;
}
async function liveCounts() {
  const client = new Client(cfg.dbConfig()); await client.connect();
  try { return await tableCounts(client, KEY_TABLES); } finally { await client.end().catch(() => {}); }
}
// Restores the dump into a temporary database, compares row counts with what the live database had, then deletes the temporary database.
async function restoreTest(file, expected) {
  const started = Date.now();
  const tmp = `relfam_restore_check_${Date.now()}`;
  const result = { ok: false, at: new Date().toISOString(), file: path.basename(file), tables: {}, ms: 0, error: '' };
  let created = false;
  try {
    expected = expected || await liveCounts();
    await run(pgBin('createdb'), [...connArgs(), tmp]); created = true;
    await run(pgBin('psql'), [...connArgs(), '-d', tmp, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file]);
    const client = new Client({ ...cfg.dbConfig(), database: tmp }); await client.connect();
    let restored; try { restored = await tableCounts(client, Object.keys(expected)); } finally { await client.end().catch(() => {}); }
    const problems = [];
    for (const [t, exp] of Object.entries(expected)) {
      const got = restored[t];
      result.tables[t] = { expected: exp, restored: got === undefined ? null : got };
      if (got === undefined) problems.push(`table ${t} is missing after restore`);
      else if (Math.abs(got - exp) > countTolerance(exp)) problems.push(`${t}: ${got} rows restored, ${exp} expected`);
    }
    if (!Object.keys(expected).length) problems.push('there is nothing to compare');
    result.ok = problems.length === 0;
    if (!result.ok) result.error = problems.join('; ');
  } catch (err) { result.error = err.message; }
  if (created) { try { await run(pgBin('dropdb'), [...connArgs(), '--if-exists', '--force', tmp], { timeoutMs: 60000 }); } catch (err) { result.leftover = tmp; result.error = (result.error ? result.error + '; ' : '') + `could not remove the temporary database ${tmp}`; } }
  result.ms = Date.now() - started;
  return result;
}

/* ───────────── the backup cycle ───────────── */
async function saveBackupStatus(patch) {
  const cur = (await db.getSettings()).backup || {};
  await db.updateSetting('backup', { ...cur, ...patch });
}
function dump(trigger) {
  fs.mkdirSync(cfg.backupDir, { recursive: true });
  const filename = `relfam-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const out = path.join(cfg.backupDir, filename);
  const c = cfg.dbConfig();
  return run(pgBin('pg_dump'), [...connArgs(), '-d', String(c.database), '-F', 'p', '-f', out]).then(() => ({ filename, out }));
}
function copyOffsite(file) {
  if (!cfg.copyDir) return { configured: false };
  try {
    fs.mkdirSync(cfg.copyDir, { recursive: true });
    const dest = path.join(cfg.copyDir, path.basename(file));
    fs.copyFileSync(file, dest);
    if (fs.statSync(dest).size !== fs.statSync(file).size) throw new Error('the copy is a different size');
    pruneBackups(cfg.copyDir);
    return { configured: true, ok: true, at: new Date().toISOString() };
  } catch (err) { return { configured: true, ok: false, at: new Date().toISOString(), error: err.message }; }
}
async function runRestoreTestNow(file) {
  const target = file || (listBackups()[0] && path.join(cfg.backupDir, listBackups()[0].name));
  if (!target) return { ok: false, error: 'there is no backup to test' };
  const result = await restoreTest(target);
  await saveBackupStatus({ restoreTest: result });
  if (!result.ok) await sendAlert('restore-test-failed', 'Backup restore test FAILED', `The backup ${result.file} could not be restored correctly: ${result.error}. Your backups may not be usable.`);
  return result;
}
// A full cycle: dump → check it is complete → record → keep only what the retention policy says → second copy → restore test when due.
async function runBackupCycle(trigger) {
  let made;
  try { made = await dump(trigger); } catch (err) { await sendAlert('backup-failed', 'Database backup FAILED', `The ${trigger} backup did not complete: ${err.message}`); throw err; }
  const v = verifyDump(made.out);
  if (!v.ok) {
    await saveBackupStatus({ lastVerify: { ok: false, at: new Date().toISOString(), file: made.filename, reason: v.reason } });
    await sendAlert('backup-invalid', 'Database backup is INCOMPLETE', `${made.filename}: ${v.reason}.`);
    throw new Error(`The backup file is not usable: ${v.reason}`);
  }
  const previous = listBackups().filter((b) => b.name !== made.filename)[0];
  const expected = await liveCounts().catch(() => null);
  const removed = pruneBackups(cfg.backupDir);
  const offsite = copyOffsite(made.out);
  const last = new Date().toISOString();
  const status = (await db.getSettings()).backup || {};
  await saveBackupStatus({ last, lastFile: made.filename, lastTrigger: trigger, lastSizeBytes: v.sizeBytes, lastVerify: { ok: true, at: last, file: made.filename }, counts: expected, removedOld: removed.length, offsite, policy: cfg.policy });
  if (previous && v.sizeBytes < previous.sizeBytes * 0.6) await sendAlert('backup-shrank', 'Database backup is much smaller than the last one', `${made.filename} is ${(v.sizeBytes / 1048576).toFixed(1)} MB, the one before was ${(previous.sizeBytes / 1048576).toFixed(1)} MB. Data may have been lost.`);
  if (offsite.configured && !offsite.ok) await sendAlert('offsite-failed', 'Backup copy to the second location FAILED', offsite.error);
  const lastTestAt = status.restoreTest && status.restoreTest.at ? new Date(status.restoreTest.at).getTime() : 0;
  if (trigger === 'manual' || Date.now() - lastTestAt > cfg.restoreEveryHours * 3600000) await runRestoreTestNow(made.out);
  return { file: made.filename, sizeBytes: v.sizeBytes, last };
}

/* ───────────── watchdog: is the app server up? ───────────── */
const watch = { up: null, fails: 0, downSince: null, lastCheckAt: null, lastOkAt: null, latencyMs: null, uptimeSec: null, lastError: '', history: [] };
async function checkAppServer() {
  const t0 = Date.now(); let ok = false, error = '', body = null;
  try {
    const res = await fetch(cfg.appHealthUrl, { signal: AbortSignal.timeout(8000) });
    ok = res.ok; if (!ok) error = `HTTP ${res.status}`; else body = await res.json().catch(() => null);
  } catch (err) { error = err.name === 'TimeoutError' ? 'no answer within 8 seconds' : (err.cause && err.cause.code) || err.message; }
  watch.lastCheckAt = new Date().toISOString(); watch.latencyMs = Date.now() - t0; watch.lastError = ok ? '' : String(error);
  watch.history.push(ok); if (watch.history.length > 1440) watch.history.shift();
  if (ok) {
    watch.lastOkAt = watch.lastCheckAt; watch.uptimeSec = body && body.uptimeSec !== undefined ? body.uptimeSec : null;
    if (watch.up === false) {
      const mins = Math.max(1, Math.round((Date.now() - new Date(watch.downSince).getTime()) / 60000));
      await sendAlert('server-down:recovered', 'Relfam server is back up', `The server answers again after about ${mins} minute${mins > 1 ? 's' : ''} down.`, { always: true });
    }
    watch.up = true; watch.fails = 0; watch.downSince = null;
  } else {
    watch.fails++;
    if (watch.fails >= cfg.failuresToAlert && watch.up !== false) {
      watch.up = false; watch.downSince = new Date(Date.now() - (watch.fails - 1) * cfg.watchdogEveryMs).toISOString();
      await sendAlert('server-down', 'Relfam server is DOWN', `The server did not answer ${watch.fails} checks in a row (${error}).`, { always: true });
    }
  }
  return { ok };
}
const uptimePct = () => (watch.history.length ? Math.round((watch.history.filter(Boolean).length / watch.history.length) * 1000) / 10 : null);

/* ───────────── error spikes ───────────── */
const SPIKE_LIMITS = { api_5xx: 10, db_error: 3, login_failed: 40, push_failed: 20, qr_failed: 15, upi_failed: 10 };
const KIND_LABEL = { api_5xx: 'Server errors', db_error: 'Database errors', login_failed: 'Failed logins', push_failed: 'Push notification failures', push_dead: 'Expired push tokens', qr_failed: 'QR problems', upi_failed: 'UPI payment problems' };
async function checkSpikes() {
  let rows = [];
  try { rows = (await db.pool.query("SELECT kind, count(*)::int AS n FROM monitoring_events WHERE at > now() - interval '5 minutes' GROUP BY kind")).rows; } catch (err) { return []; }
  const fired = [];
  for (const r of rows) {
    const limit = SPIKE_LIMITS[r.kind];
    if (limit && r.n >= limit && await sendAlert(`spike:${r.kind}`, `${KIND_LABEL[r.kind] || r.kind}: ${r.n} in 5 minutes`, `${KIND_LABEL[r.kind] || r.kind} is unusually high (${r.n} in the last 5 minutes, alert at ${limit}). Open System Health in the admin app to see the details.`)) fired.push(r.kind);
  }
  return fired;
}

/* ───────────── what the System Health screen shows ───────────── */
async function eventsSummary() {
  try {
    const counts = (await db.pool.query("SELECT kind, count(*) FILTER (WHERE at > now() - interval '1 hour')::int AS h1, count(*) FILTER (WHERE at > now() - interval '24 hours')::int AS h24 FROM monitoring_events WHERE at > now() - interval '24 hours' GROUP BY kind")).rows;
    const recent = (await db.pool.query('SELECT id, at, kind, detail FROM monitoring_events ORDER BY id DESC LIMIT 40')).rows;
    return { counts, recent };
  } catch (err) { return { counts: [], recent: [], unavailable: true }; }
}
async function systemHealth() {
  const settings = await db.getSettings();
  const b = settings.backup || {};
  const files = listBackups();
  const ops = await readOps();
  return {
    checkedAt: new Date().toISOString(),
    server: { up: watch.up, downSince: watch.downSince, lastCheckAt: watch.lastCheckAt, lastOkAt: watch.lastOkAt, latencyMs: watch.latencyMs, uptimeSec: watch.uptimeSec, lastError: watch.lastError, uptimePct24h: uptimePct(), checks: watch.history.length },
    backups: {
      auto: !!b.auto, freq: b.freq || 'Daily', last: b.last || null, lastFile: b.lastFile || null, lastSizeBytes: b.lastSizeBytes || null,
      lastVerify: b.lastVerify || null, restoreTest: b.restoreTest || null, offsite: b.offsite || { configured: !!cfg.copyDir },
      policy: cfg.policy, count: files.length, totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0), files: files.slice(0, 30),
    },
    events: await eventsSummary(),
    kinds: KIND_LABEL,
    alerts: (ops.alerts || []).slice(0, 20),
    alertEmailConfigured: !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO),
    alertEmail: process.env.ALERT_EMAIL_TO ? await recipientCanReceive() : { configured: false },
  };
}

/* ───────────── background jobs ───────────── */
function start() {
  const timers = [];
  timers.push(setInterval(() => checkAppServer().catch((e) => console.error('Watchdog failed:', e.message)), cfg.watchdogEveryMs));
  timers.push(setInterval(() => checkSpikes().catch((e) => console.error('Spike check failed:', e.message)), cfg.watchdogEveryMs));
  // Every 30 minutes: a restore test that is overdue, or an automatic backup that has stopped happening, is itself an alert.
  timers.push(setInterval(async () => {
    try {
      const b = (await db.getSettings()).backup || {};
      const tested = b.restoreTest && b.restoreTest.at ? new Date(b.restoreTest.at).getTime() : 0;
      if (b.last && Date.now() - tested > cfg.restoreEveryHours * 3600000 * 1.5) await runRestoreTestNow();
      const every = { Hourly: 3600000, Daily: 86400000, Weekly: 604800000 }[b.freq] || 86400000;
      if (b.auto && b.last && Date.now() - new Date(b.last).getTime() > every * 2) await sendAlert('backup-overdue', 'Database backup is overdue', `The last backup was ${new Date(b.last).toLocaleString()}; the schedule is ${b.freq || 'Daily'}.`);
    } catch (err) { console.error('Backup watch failed:', err.message); }
  }, 30 * 60000));
  checkAppServer().catch(() => {});
  return () => timers.forEach(clearInterval);
}

module.exports = {
  configure, cfg, start, runBackupCycle, runRestoreTestNow, restoreTest, verifyDump, pickBackupsToKeep, pruneBackups, listBackups, parseStamp,
  sendAlert, sendTestAlert, recipientCanReceive, checkAppServer, checkSpikes, systemHealth, liveCounts, watch, SPIKE_LIMITS, KEY_TABLES,
};
