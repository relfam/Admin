const crypto = require('crypto');
const { Pool, types } = require('pg');

// Same fix as the mobile server (server/db.js in EventX-mobile-latest) — return DATE columns as
// the raw 'YYYY-MM-DD' string instead of a JS Date, which otherwise shifts a day once
// JSON.stringify renders it in UTC.
types.setTypeParser(1082, (val) => val);

// This connects to the SAME `relfam` Postgres database the mobile app's server uses — the admin
// app reads real users/events/gift_records/family_links from it directly (no service-to-service
// calls needed, it's one database) and additionally owns the admin-only tables created below.
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'relfam',
});

const MENU_IDS = [
  'dashboard', 'users', 'events', 'gifts', 'payments', 'families', 'fraud', 'reports',
  'analytics', 'notifications', 'ads', 'support', 'content', 'settings', 'admins', 'audit',
];

async function init() {
  await pool.query(`
    -- Additive columns on the mobile app's own tables (same pattern it already uses: ADD COLUMN
    -- IF NOT EXISTS everywhere, safe to run against a database that predates these columns).
    -- 'status' backs the Suspend/Block actions on the admin Users screen; the mobile app itself
    -- has no notion of this today, so it always defaults to 'Active'.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Support',
      access_all BOOLEAN NOT NULL DEFAULT false,
      access JSONB NOT NULL DEFAULT '[]',
      tfa_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_active_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
      ip TEXT,
      device_label TEXT
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      billing_period TEXT NOT NULL DEFAULT 'month',
      features JSONB NOT NULL DEFAULT '[]',
      active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id TEXT NOT NULL REFERENCES packages(id),
      amount INTEGER NOT NULL DEFAULT 0,
      method TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS fraud_cases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'New',
      evidence TEXT,
      signal TEXT,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Open',
      assigned_admin_id INTEGER REFERENCES admins(id),
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      event_type TEXT NOT NULL DEFAULT 'All types',
      target_user_id INTEGER REFERENCES users(id),
      date_mode TEXT NOT NULL DEFAULT 'All dates',
      from_date DATE,
      to_date DATE,
      placement TEXT NOT NULL DEFAULT 'Event page banner',
      status TEXT NOT NULL DEFAULT 'Draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- Creative asset (a data: URL, same pattern events.cover/qr_image already use elsewhere in
    -- this schema — no file storage service to wire up) and an optional destination the banner
    -- opens when tapped in the mobile app.
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS image TEXT;
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS link_url TEXT;
    -- Per-user daily dismiss cap, alongside (not replacing) date_mode/from_date/to_date — the web
    -- form exposes both once "Show per day" is set to Custom: a custom numeric limit plus an
    -- optional custom campaign date window. NULL max_per_day = "All day" = no cap, keep showing
    -- regardless of how many times this user has dismissed it today. Enforced by the mobile
    -- server (see listActiveAdsForUser + ad_dismissals table in EventX-mobile-latest/server/db.js),
    -- which is what actually knows per-user dismiss counts.
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS max_per_day INTEGER;
    -- Location targeting — NULL/empty means no restriction on that dimension. A user matches if
    -- their profile state is ANY of target_states (and, if target_districts is set, their
    -- district is ANY of those too) — see users.state/users.district and listActiveAdsForUser in
    -- EventX-mobile-latest/server/db.js. Only populated once a user actually fills Edit Profile in
    -- — a user with no state set never matches a state-targeted ad, by design.
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_state TEXT;
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_district TEXT;
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_states TEXT[];
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_districts TEXT[];
    -- Multi-user targeting, replacing the old single target_user_id (still present, unused going
    -- forward) — NULL/empty means not restricted to specific users.
    ALTER TABLE ads ADD COLUMN IF NOT EXISTS target_user_ids INTEGER[];

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admins(id),
      action TEXT NOT NULL,
      module TEXT,
      ip TEXT,
      device TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      published BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      placement TEXT NOT NULL DEFAULT 'Home banner',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'
    );

    -- Push campaigns queued for a future time (Notifications screen, Schedule != "Send now").
    -- This server has no separate worker process, so runDueScheduledNotifications() (a setInterval
    -- in index.js) polls this table itself every 30s and sends anything whose scheduled_at has
    -- passed — see the comment there for why that's good enough here.
    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'All users',
      target_user_id INTEGER REFERENCES users(id),
      target_state TEXT,
      target_district TEXT,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      sent_count INTEGER,
      failed_count INTEGER,
      error TEXT,
      created_by_admin_id INTEGER REFERENCES admins(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    );
    -- Multi-state/district/user targeting — same shape as the equivalent columns on ads (see
    -- above). These must be added via ALTER, not folded into the CREATE TABLE above: this table
    -- already existed by the time these columns were introduced, and CREATE TABLE IF NOT EXISTS
    -- is a no-op against an existing table, so anything only listed there would silently never
    -- reach the database.
    ALTER TABLE scheduled_notifications ADD COLUMN IF NOT EXISTS target_states TEXT[];
    ALTER TABLE scheduled_notifications ADD COLUMN IF NOT EXISTS target_districts TEXT[];
    ALTER TABLE scheduled_notifications ADD COLUMN IF NOT EXISTS target_user_ids INTEGER[];

    -- TOTP secret, set on first successful enrollment (see /api/admin/auth/tfa/verify). Null
    -- means this admin hasn't completed 2FA setup yet, even if tfa_enabled is true.
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS tfa_secret TEXT;
  `);

  await pool.query(`
    INSERT INTO packages (id, name, price, billing_period, features, active) VALUES
      ('regular', 'Regular', 0, 'forever', '["1 event","50 gift records","Basic ledger","1 family member"]', true),
      ('pro', 'Pro', 199, 'month', '["Unlimited events","Unlimited records","QR collection","5 family members"]', true),
      ('advanced', 'Advanced', 499, 'month', '["Everything in Pro","Payment links","Priority support","Unlimited family","Reciprocity insights"]', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  const { rows: existingAdmins } = await pool.query('SELECT COUNT(*)::int AS n FROM admins');
  if (existingAdmins[0].n === 0) {
    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;
    const name = process.env.ADMIN_SEED_NAME || 'Super Admin';
    if (email && password) {
      await pool.query(
        'INSERT INTO admins (name, email, password_hash, role, access_all, tfa_enabled) VALUES ($1, $2, $3, $4, true, true)',
        [name, email.toLowerCase(), hashPassword(password), 'Super Admin']
      );
      console.log(`Seeded Super Admin account: ${email}`);
    } else {
      console.warn('No admins exist yet and ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are not set — see .env.example.');
    }
  }
}

const TOKEN_PEPPER = process.env.ADMIN_TOKEN_PEPPER;
if (!TOKEN_PEPPER) throw new Error('ADMIN_TOKEN_PEPPER is not set — see server/.env.example');

// scrypt, not the mobile app's peppered-HMAC PIN scheme — admin passwords are free-form (not a
// fixed 6-digit space), so they need a real salted KDF rather than a pepper-only HMAC.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function toPublicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    access: row.access_all ? 'all' : row.access,
    tfa: row.tfa_enabled,
    createdAt: row.created_at,
    lastActive: row.last_active_at,
  };
}

async function findAdminByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE email = $1', [String(email || '').toLowerCase()]);
  return rows[0];
}

async function findAdminById(id) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
  return rows[0];
}

async function createAdminSession(adminId, { ip, deviceLabel } = {}) {
  // HMAC with TOKEN_PEPPER rather than a bare random value: the token is already unguessable on
  // its own (256 bits), but mixing in a secret this database dump doesn't contain means a stolen
  // admins/admin_sessions table alone still can't be used to mint or predict a valid session token.
  const token = crypto.createHmac('sha256', TOKEN_PEPPER).update(crypto.randomBytes(32)).digest('hex');
  await pool.query(
    'INSERT INTO admin_sessions (token, admin_id, ip, device_label) VALUES ($1, $2, $3, $4)',
    [token, adminId, ip || null, deviceLabel || null]
  );
  return token;
}

async function findAdminByToken(token) {
  const { rows } = await pool.query(`
    SELECT admins.* FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token = $1 AND admin_sessions.expires_at > now()
  `, [token]);
  if (rows[0]) await pool.query('UPDATE admins SET last_active_at = now() WHERE id = $1', [rows[0].id]);
  return rows[0];
}

async function deleteAdminSession(token) {
  await pool.query('DELETE FROM admin_sessions WHERE token = $1', [token]);
}

async function listAdmins() {
  const { rows } = await pool.query('SELECT * FROM admins ORDER BY created_at ASC');
  return rows.map(toPublicAdmin);
}

async function createAdmin({ name, email, password, role, access, tfa }) {
  const accessAll = access === 'all';
  const { rows } = await pool.query(
    `INSERT INTO admins (name, email, password_hash, role, access_all, access, tfa_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, String(email || '').toLowerCase(), hashPassword(password || crypto.randomBytes(9).toString('base64')), role || 'Support', accessAll, JSON.stringify(accessAll ? [] : (access || [])), tfa !== false]
  );
  return toPublicAdmin(rows[0]);
}

async function updateAdmin(id, { name, email, role, access, tfa }) {
  const accessAll = access === 'all';
  const { rows } = await pool.query(
    `UPDATE admins SET name = COALESCE($2, name), email = COALESCE($3, email), role = COALESCE($4, role),
       access_all = $5, access = $6, tfa_enabled = COALESCE($7, tfa_enabled)
     WHERE id = $1 RETURNING *`,
    [id, name || null, email ? email.toLowerCase() : null, role || null, accessAll, JSON.stringify(accessAll ? [] : (access || [])), tfa]
  );
  return toPublicAdmin(rows[0]);
}

async function toggleAdminTfa(id) {
  const { rows } = await pool.query('UPDATE admins SET tfa_enabled = NOT tfa_enabled WHERE id = $1 RETURNING *', [id]);
  return toPublicAdmin(rows[0]);
}

// Called once, at the end of the enrollment step in POST /api/admin/auth/tfa/verify — before
// this, tfa_secret is null even for an admin with tfa_enabled=true, which is how the login route
// knows to send them through setup instead of straight to a code prompt.
async function setAdminTfaSecret(id, secret) {
  await pool.query('UPDATE admins SET tfa_secret = $2 WHERE id = $1', [id, secret]);
}

async function deleteAdmin(id) {
  await pool.query('DELETE FROM admins WHERE id = $1', [id]);
}

async function logAudit({ adminId, action, module, ip, device }) {
  await pool.query(
    'INSERT INTO audit_logs (admin_id, action, module, ip, device) VALUES ($1, $2, $3, $4, $5)',
    [adminId || null, action, module || null, ip || null, device || null]
  );
}

async function listAuditLogs({ limit = 200 } = {}) {
  const { rows } = await pool.query(`
    SELECT al.*, a.name AS admin_name FROM audit_logs al
    LEFT JOIN admins a ON a.id = al.admin_id
    ORDER BY al.created_at DESC LIMIT $1
  `, [limit]);
  return rows;
}

/* ─────────────────────────── Users ─────────────────────────── */

const USERS_PAGE_SIZE = 50;
// `filter` mirrors the Users screen's single row of chips (All/Active/Suspended/Blocked/Regular/
// Pro/Advanced) — one value that can match EITHER u.status OR the resolved package, same as the
// client-side check this replaced (`u.status === filter || u.pkg === filter`). Building the WHERE
// clause here (rather than the old bare, unparenthesized `search`-only version) matters once a
// second condition joins it: `a OR b OR c AND d` and `(a OR b OR c) AND d` are not the same query,
// so every OR-group below is explicitly parenthesized.
function usersWhereClause({ search, filter }) {
  const params = [];
  const conditions = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (filter && filter !== 'All') {
    params.push(filter);
    const statusIdx = params.length;
    params.push(filter.toLowerCase());
    const pkgIdx = params.length;
    conditions.push(`(u.status = $${statusIdx} OR COALESCE(sub.package_id, 'regular') = $${pkgIdx})`);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

async function listUsers({ search, filter, page = 0 } = {}) {
  const { where, params } = usersWhereClause({ search, filter });
  params.push(USERS_PAGE_SIZE, Math.max(0, page) * USERS_PAGE_SIZE);
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.mobile, u.email, u.address, u.state, u.district, u.status, u.created_at,
      COALESCE(ev.cnt, 0)::int AS events_count,
      COALESCE(gr.cnt, 0)::int AS gifts_count,
      s.last_seen_at,
      COALESCE(sub.package_id, 'regular') AS package_id
    FROM users u
    LEFT JOIN (SELECT owner_user_id, COUNT(*) cnt FROM events GROUP BY owner_user_id) ev ON ev.owner_user_id = u.id
    LEFT JOIN (SELECT owner_user_id, COUNT(*) cnt FROM gift_records GROUP BY owner_user_id) gr ON gr.owner_user_id = u.id
    LEFT JOIN LATERAL (SELECT last_seen_at FROM sessions WHERE user_id = u.id ORDER BY last_seen_at DESC LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT package_id FROM subscriptions WHERE user_id = u.id AND status = 'Active' ORDER BY activated_at DESC LIMIT 1) sub ON true
    ${where}
    ORDER BY u.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return rows;
}

async function countUsers({ search, filter } = {}) {
  const { where, params } = usersWhereClause({ search, filter });
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM users u
    LEFT JOIN LATERAL (SELECT package_id FROM subscriptions WHERE user_id = u.id AND status = 'Active' ORDER BY activated_at DESC LIMIT 1) sub ON true
    ${where}
  `, params);
  return rows[0].total;
}

async function getUserDetail(id) {
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.mobile, u.email, u.address, u.state, u.district, u.status, u.created_at,
      COALESCE(ev.cnt, 0)::int AS events_count,
      COALESCE(gr.cnt, 0)::int AS gifts_count,
      COALESCE(gr.total, 0)::bigint AS gifts_total,
      COALESCE(sub.package_id, 'regular') AS package_id
    FROM users u
    LEFT JOIN (SELECT owner_user_id, COUNT(*) cnt FROM events WHERE owner_user_id = $1 GROUP BY owner_user_id) ev ON ev.owner_user_id = u.id
    LEFT JOIN (SELECT owner_user_id, COUNT(*) cnt, SUM(amount) total FROM gift_records WHERE owner_user_id = $1 GROUP BY owner_user_id) gr ON gr.owner_user_id = u.id
    LEFT JOIN LATERAL (SELECT package_id FROM subscriptions WHERE user_id = u.id AND status = 'Active' ORDER BY activated_at DESC LIMIT 1) sub ON true
    WHERE u.id = $1
  `, [id]);
  const user = rows[0];
  if (!user) return null;

  const [{ rows: events }, { rows: gifts }, { rows: sessions }, { rows: subs }] = await Promise.all([
    pool.query('SELECT client_id, name, type, date, target_amount FROM events WHERE owner_user_id = $1 ORDER BY updated_at DESC LIMIT 10', [id]),
    pool.query('SELECT client_id, title, person, amount, mode, status, direction, date FROM gift_records WHERE owner_user_id = $1 ORDER BY updated_at DESC LIMIT 10', [id]),
    pool.query('SELECT token, device_label, created_at, last_seen_at FROM sessions WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT 5', [id]),
    pool.query(`
      SELECT s.*, p.name AS package_name FROM subscriptions s JOIN packages p ON p.id = s.package_id
      WHERE s.user_id = $1 ORDER BY s.activated_at DESC LIMIT 1
    `, [id]),
  ]);

  return { ...user, events, gifts, sessions, subscription: subs[0] || null };
}

async function setUserStatus(id, status) {
  const { rows } = await pool.query('UPDATE users SET status = $2 WHERE id = $1 RETURNING id, status', [id, status]);
  return rows[0];
}

// Same push_token column the mobile app's own server writes to (see setPushToken /
// /api/auth/push-token in EventX-mobile-latest/server) — read directly since it's the same
// database, no need to proxy this through that server. A specific targetUserId overrides the
// base audience entirely (sending to one named person, same as Ads' "Target user"); state/
// district — same fields as Ads' location targeting — further narrow whichever base audience
// or specific user was picked (though narrowing a single already-specific user by location is a
// no-op in practice, it's harmless to allow).
async function listPushTokensForAudience(audience, { userIds, states, districts } = {}) {
  const params = [];
  let where = `u.push_token IS NOT NULL`;
  if (userIds && userIds.length) {
    params.push(userIds);
    where += ` AND u.id = ANY($${params.length})`;
  } else if (audience === 'Active 30d') {
    where += ` AND EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.last_seen_at > now() - interval '30 days')`;
  } else if (audience === 'Pro + Advanced') {
    where += ` AND EXISTS (
      SELECT 1 FROM subscriptions sub WHERE sub.user_id = u.id AND sub.status = 'Active' AND sub.package_id IN ('pro', 'advanced')
    )`;
  }
  if (states && states.length) {
    params.push(states);
    where += ` AND u.state = ANY($${params.length})`;
  }
  if (districts && districts.length) {
    params.push(districts.map((d) => d.toLowerCase()));
    where += ` AND lower(u.district) = ANY($${params.length})`;
  }
  const { rows } = await pool.query(`SELECT u.id, u.name, u.push_token FROM users u WHERE ${where}`, params);
  return rows;
}

/* ─────────────────────────── Scheduled push campaigns ─────────────────────────── */

async function createScheduledNotification({ title, body, audience, targetUserIds, targetStates, targetDistricts, scheduledAt, adminId }) {
  const { rows } = await pool.query(
    `INSERT INTO scheduled_notifications (title, body, audience, target_user_ids, target_states, target_districts, scheduled_at, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, body, audience || 'All users', targetUserIds || null, targetStates || null, targetDistricts || null, scheduledAt, adminId || null]
  );
  return rows[0];
}

async function listScheduledNotifications() {
  const { rows } = await pool.query(`
    SELECT sn.*,
      (SELECT array_agg(u.name) FROM users u WHERE u.id = ANY(sn.target_user_ids)) AS target_user_names,
      a.name AS created_by_name
    FROM scheduled_notifications sn
    LEFT JOIN admins a ON a.id = sn.created_by_admin_id
    ORDER BY sn.scheduled_at DESC
  `);
  return rows;
}

async function listDueScheduledNotifications() {
  const { rows } = await pool.query(
    `SELECT * FROM scheduled_notifications WHERE status = 'Pending' AND scheduled_at <= now()`
  );
  return rows;
}

async function markScheduledNotificationSent(id, sentCount, failedCount) {
  await pool.query(
    `UPDATE scheduled_notifications SET status = 'Sent', sent_count = $2, failed_count = $3, sent_at = now() WHERE id = $1`,
    [id, sentCount, failedCount]
  );
}

async function markScheduledNotificationFailed(id, error) {
  await pool.query(`UPDATE scheduled_notifications SET status = 'Failed', error = $2 WHERE id = $1`, [id, String(error).slice(0, 500)]);
}

async function cancelScheduledNotification(id) {
  const { rows } = await pool.query(
    `DELETE FROM scheduled_notifications WHERE id = $1 AND status = 'Pending' RETURNING id`,
    [id]
  );
  return rows[0];
}

/* ─────────────────────────── Events ─────────────────────────── */

async function listEvents() {
  const { rows } = await pool.query(`
    SELECT e.owner_user_id, e.client_id, e.name, e.type, e.date, e.venue, e.target_amount, e.code,
      u.id AS host_id, u.name AS host_name,
      COALESCE(g.cnt, 0)::int AS gifts_count, COALESCE(g.total, 0)::bigint AS total_amount
    FROM events e
    JOIN users u ON u.id = e.owner_user_id
    LEFT JOIN (
      SELECT owner_user_id, event_client_id, COUNT(*) cnt, SUM(amount) total
      FROM gift_records GROUP BY owner_user_id, event_client_id
    ) g ON g.owner_user_id = e.owner_user_id AND g.event_client_id = e.client_id
    ORDER BY e.updated_at DESC
  `);
  return rows;
}

/* ─────────────────────────── Gift records ─────────────────────────── */

async function listGifts({ search } = {}) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE gr.person ILIKE $1 OR u.name ILIKE $1`;
  }
  const { rows } = await pool.query(`
    SELECT gr.owner_user_id, gr.client_id, gr.person, gr.mobile, gr.amount, gr.mode, gr.status,
      gr.direction, gr.date, gr.title, u.name AS owner_name, e.name AS event_name
    FROM gift_records gr
    JOIN users u ON u.id = gr.owner_user_id
    LEFT JOIN events e ON e.owner_user_id = gr.owner_user_id AND e.client_id = gr.event_client_id
    ${where}
    ORDER BY gr.updated_at DESC
    LIMIT 500
  `, params);
  return rows;
}

async function setGiftStatus(ownerUserId, clientId, status) {
  const { rows } = await pool.query(
    'UPDATE gift_records SET status = $3 WHERE owner_user_id = $1 AND client_id = $2 RETURNING owner_user_id, client_id, status',
    [ownerUserId, clientId, status]
  );
  return rows[0];
}

/* ─────────────────────────── Families ─────────────────────────── */

const FAMILIES_PAGE_SIZE = 24;
// Loading every family unconditionally (the old version of this query) works fine at today's
// scale but falls over completely once there are enough of them to matter — the whole point of
// an admin tool. Matches on the family's own name or any member's name/mobile, found via a
// `matching` CTE BEFORE paging, so LIMIT/OFFSET operates on distinct families (one row each) —
// paging the raw family_links rows instead would split (or entirely skip) a family whose members
// straddle a page boundary, since json_agg only happens after grouping.
async function listFamilies({ search, page = 0 } = {}) {
  const like = search ? `%${search}%` : null;
  const offset = Math.max(0, page) * FAMILIES_PAGE_SIZE;
  const { rows } = await pool.query(`
    WITH matching AS (
      SELECT DISTINCT fl.primary_user_id
      FROM family_links fl
      JOIN users u ON u.id = fl.primary_user_id
      WHERE $1::text IS NULL OR u.name ILIKE $1 OR fl.member_name ILIKE $1 OR fl.member_mobile ILIKE $1
    ),
    page AS (
      SELECT m.primary_user_id, u.name AS head_name
      FROM matching m JOIN users u ON u.id = m.primary_user_id
      ORDER BY u.name
      LIMIT $2 OFFSET $3
    )
    SELECT p.primary_user_id, p.head_name,
      json_agg(json_build_object('id', fl.id, 'name', COALESCE(fl.member_name, fl.member_mobile), 'mobile', fl.member_mobile, 'relation', COALESCE(fl.relation, 'Relative')) ORDER BY fl.created_at) AS members,
      COALESCE(ev.cnt, 0)::int AS events_count, COALESCE(gr.total, 0)::bigint AS moi_total
    FROM page p
    JOIN family_links fl ON fl.primary_user_id = p.primary_user_id
    LEFT JOIN (SELECT owner_user_id, COUNT(*) cnt FROM events GROUP BY owner_user_id) ev ON ev.owner_user_id = p.primary_user_id
    LEFT JOIN (SELECT owner_user_id, SUM(amount) total FROM gift_records GROUP BY owner_user_id) gr ON gr.owner_user_id = p.primary_user_id
    GROUP BY p.primary_user_id, p.head_name, ev.cnt, gr.total
    ORDER BY p.head_name
  `, [like, FAMILIES_PAGE_SIZE, offset]);
  return rows;
}

async function countFamilies({ search } = {}) {
  const like = search ? `%${search}%` : null;
  const { rows } = await pool.query(`
    SELECT COUNT(DISTINCT fl.primary_user_id)::int AS total
    FROM family_links fl
    JOIN users u ON u.id = fl.primary_user_id
    WHERE $1::text IS NULL OR u.name ILIKE $1 OR fl.member_name ILIKE $1 OR fl.member_mobile ILIKE $1
  `, [like]);
  return rows[0].total;
}

async function removeFamilyMember(id) {
  await pool.query('DELETE FROM family_links WHERE id = $1', [id]);
}

async function addFamilyMember(primaryUserId, { name, mobile, relation }) {
  const { rows } = await pool.query(
    `INSERT INTO family_links (primary_user_id, member_mobile, member_name, relation)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [primaryUserId, mobile || '—', name, relation || 'Relative']
  );
  return rows[0];
}

/* ─────────────────────────── Packages & subscriptions ─────────────────────────── */

async function listPackages() {
  const { rows } = await pool.query('SELECT * FROM packages ORDER BY price ASC');
  return rows;
}

async function updatePackage(id, { price, features, active }) {
  const { rows } = await pool.query(
    'UPDATE packages SET price = COALESCE($2, price), features = COALESCE($3, features), active = COALESCE($4, active) WHERE id = $1 RETURNING *',
    [id, price, features ? JSON.stringify(features) : null, active]
  );
  return rows[0];
}

async function listSubscriptions() {
  const { rows } = await pool.query(`
    SELECT s.*, u.name AS user_name, p.name AS package_name
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    JOIN packages p ON p.id = s.package_id
    ORDER BY s.activated_at DESC
  `);
  return rows;
}

async function createSubscription({ userId, packageId, amount, method }) {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, package_id, amount, method, status, expires_at)
     VALUES ($1, $2, $3, $4, 'Active', now() + interval '30 days') RETURNING *`,
    [userId, packageId, amount || 0, method || 'Manual']
  );
  return rows[0];
}

async function updateSubscriptionStatus(id, status) {
  const extra = status === 'Active' ? `, activated_at = now(), expires_at = now() + interval '30 days'` : '';
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = $2 ${extra} WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0];
}

/* ─────────────────────────── Feedback ─────────────────────────── */
// Reads/writes the `feedback` table owned by the mobile app's own server (its Feedback screen
// inserts into it directly — see submitFeedback in www/index.html) — same database, so this is
// a plain read + status update, no proxying needed, same pattern as users/events/gift_records.

async function listFeedback({ status, rating } = {}) {
  const params = [];
  const clauses = [];
  if (status && status !== 'All') { params.push(status); clauses.push(`f.status = $${params.length}`); }
  if (rating && rating !== 'All') { params.push(Number(rating)); clauses.push(`f.rating = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT f.*, u.name AS user_name, u.mobile, u.email
    FROM feedback f JOIN users u ON u.id = f.user_id
    ${where}
    ORDER BY f.created_at DESC
  `, params);
  return rows;
}

async function updateFeedbackStatus(id, status) {
  const { rows } = await pool.query('UPDATE feedback SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  return rows[0];
}

/* ─────────────────────────── Referral rewards ─────────────────────────── */
// Written by the main app's Refer & Earn feature (EventX-mobile-latest/server/src/services/
// referral.js). The app only ever moves a reward earned -> claimed; paying it out and closing it
// is a deliberate human step here, since nothing in Relfam can verify a "collected gifts" claim.
// What the admin sees for each reward: who, how much, where to pay — plus EVIDENCE for deciding
// whether to pay it: what the friend actually did (their events and gift entries, read from the queryable
// mirror tables, not the JSON blob) and how the referrer has behaved, and any warning flags. Flags are the
// ones stored when the friend qualified (risk_flags) plus ones that can only be worked out now.
async function listReferralRewards({ status } = {}) {
  const params = [];
  let where = "WHERE r.status <> 'capped'";
  if (status && status !== 'All') { params.push(status); where += ` AND r.status = $${params.length}`; }
  try {
    const { rows } = await pool.query(`
      SELECT r.*,
        ru.name AS referrer_name, ru.mobile AS referrer_mobile, ru.status AS referrer_status, ru.created_at AS referrer_joined_at,
        eu.name AS referee_name, eu.mobile AS referee_mobile, eu.created_at AS referee_joined_at,
        (SELECT count(*)::int FROM users c WHERE c.referred_by_user_id = r.referrer_user_id) AS referrer_invited,
        (SELECT count(*)::int FROM referral_rewards x WHERE x.referrer_user_id = r.referrer_user_id AND x.status <> 'capped') AS referrer_qualified,
        (SELECT COALESCE(sum(x.amount), 0)::int FROM referral_rewards x WHERE x.referrer_user_id = r.referrer_user_id AND x.status = 'paid') AS referrer_paid_total,
        (SELECT count(*)::int FROM events e WHERE e.owner_user_id = r.referee_user_id) AS referee_events,
        (SELECT string_agg(COALESCE(e.name, '?') || ' (' || COALESCE(e.type, '') || ', ' || COALESCE(e.date, '') || ')', '; ') FROM events e WHERE e.owner_user_id = r.referee_user_id) AS referee_event_list,
        (SELECT count(*)::int FROM gift_records g WHERE g.owner_user_id = r.referee_user_id AND g.direction = 'received' AND g.amount > 0) AS referee_entries,
        (SELECT count(DISTINCT lower(COALESCE(NULLIF(g.person, ''), g.mobile)))::int FROM gift_records g WHERE g.owner_user_id = r.referee_user_id AND g.direction = 'received' AND g.amount > 0) AS referee_givers,
        (SELECT COALESCE(sum(g.amount), 0)::int FROM gift_records g WHERE g.owner_user_id = r.referee_user_id AND g.direction = 'received' AND g.amount > 0) AS referee_collected,
        EXISTS (SELECT 1 FROM referral_rewards x WHERE r.claim_upi_id IS NOT NULL AND lower(x.claim_upi_id) = lower(r.claim_upi_id) AND x.referrer_user_id <> r.referrer_user_id) AS upi_shared,
        (SELECT count(*)::int FROM fraud_cases f WHERE f.user_id = r.referrer_user_id AND f.status IN ('New', 'Under Review')) AS referrer_open_fraud_cases
      FROM referral_rewards r
      JOIN users ru ON ru.id = r.referrer_user_id
      JOIN users eu ON eu.id = r.referee_user_id
      ${where}
      ORDER BY CASE r.status WHEN 'claimed' THEN 0 WHEN 'earned' THEN 1 ELSE 2 END, COALESCE(r.claimed_at, r.earned_at) DESC
    `, params);
    return rows.map((r) => {
      const flags = new Set(r.risk_flags || []);
      // Only worth flagging while there is still a decision to make.
      if (['earned', 'claimed'].includes(r.status)) {
        if (r.upi_shared) flags.add('upi_used_by_other_referrer');
        if (r.referrer_status === 'Suspended') flags.add('referrer_suspended');
        if (r.referrer_open_fraud_cases > 0) flags.add('referrer_has_open_fraud_case');
        // The friend qualified on 3+ different givers; if that evidence has since gone, be suspicious.
        if (r.referee_givers < 3) flags.add('friend_evidence_missing');
      }
      return { ...r, flags: [...flags] };
    });
  } catch (err) {
    // 42P01 = table not created yet (the main app server creates it on its next start) — an empty
    // queue is the correct thing to show until then, not a 500 that breaks the whole dashboard load.
    if (err.code === '42P01') return [];
    throw err;
  }
}

// "How much has been earned, from how many referrals": program-wide totals, the prize pool's progress,
// and one row per referrer. "Earned" counts rewards that are earned, claimed or paid (not rejected).
async function getReferralSummary() {
  const empty = { totals: null, pool: null, referrers: [] };
  try {
    const t = (await pool.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE referred_by_user_id IS NOT NULL) AS joined,
        count(*) FILTER (WHERE status <> 'capped')::int AS qualified,
        count(*) FILTER (WHERE status = 'capped')::int AS capped,
        count(*) FILTER (WHERE status = 'earned')::int AS unclaimed_n,
        COALESCE(sum(amount) FILTER (WHERE status = 'earned'), 0)::int AS unclaimed,
        count(*) FILTER (WHERE status = 'claimed')::int AS awaiting_n,
        COALESCE(sum(amount) FILTER (WHERE status = 'claimed'), 0)::int AS awaiting,
        count(*) FILTER (WHERE status = 'paid')::int AS paid_n,
        COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0)::int AS paid,
        count(*) FILTER (WHERE status = 'rejected')::int AS rejected_n,
        COALESCE(sum(amount) FILTER (WHERE status = 'rejected'), 0)::int AS rejected,
        count(*) FILTER (WHERE status <> 'capped' AND cardinality(risk_flags) > 0)::int AS flagged
      FROM referral_rewards
    `)).rows[0];
    t.earned = t.unclaimed + t.awaiting + t.paid;
    t.earned_n = t.unclaimed_n + t.awaiting_n + t.paid_n;
    t.avg = t.earned_n ? Math.round((t.earned / t.earned_n) * 100) / 100 : 0;

    // Prize pool: the current block's remaining prizes (so the admin can see the budget left in it) and
    // every prize handed out so far.
    let poolInfo = null;
    try {
      const cur = (await pool.query('SELECT COALESCE(MAX(block_no), 0)::int AS b FROM referral_reward_pool')).rows[0].b;
      if (cur) {
        const slots = (await pool.query(
          'SELECT amount, count(*)::int AS total, count(used_at)::int AS used FROM referral_reward_pool WHERE block_no = $1 GROUP BY amount ORDER BY amount DESC', [cur]
        )).rows;
        const given = (await pool.query(
          'SELECT amount, count(*)::int AS n FROM referral_reward_pool WHERE used_at IS NOT NULL GROUP BY amount ORDER BY amount DESC'
        )).rows;
        poolInfo = {
          block: cur,
          size: slots.reduce((n, s) => n + s.total, 0),
          used: slots.reduce((n, s) => n + s.used, 0),
          remaining: slots.map((s) => ({ amount: s.amount, left: s.total - s.used, of: s.total })),
          given,
        };
      }
    } catch (err) { if (err.code !== '42P01') throw err; }

    const referrers = (await pool.query(`
      SELECT u.id, u.name, u.mobile, u.status,
        (SELECT count(*)::int FROM users c WHERE c.referred_by_user_id = u.id) AS invited,
        COALESCE(s.qualified, 0) AS qualified, COALESCE(s.total_earned, 0) AS total_earned, COALESCE(s.paid, 0) AS paid,
        COALESCE(s.awaiting, 0) AS awaiting, COALESCE(s.unclaimed, 0) AS unclaimed, COALESCE(s.rejected, 0) AS rejected, COALESCE(s.flagged, 0) AS flagged
      FROM users u
      LEFT JOIN (
        SELECT referrer_user_id,
          count(*) FILTER (WHERE status <> 'capped')::int AS qualified,
          COALESCE(sum(amount) FILTER (WHERE status IN ('earned', 'claimed', 'paid')), 0)::int AS total_earned,
          COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0)::int AS paid,
          COALESCE(sum(amount) FILTER (WHERE status = 'claimed'), 0)::int AS awaiting,
          COALESCE(sum(amount) FILTER (WHERE status = 'earned'), 0)::int AS unclaimed,
          COALESCE(sum(amount) FILTER (WHERE status = 'rejected'), 0)::int AS rejected,
          count(*) FILTER (WHERE status <> 'capped' AND cardinality(risk_flags) > 0)::int AS flagged
        FROM referral_rewards GROUP BY referrer_user_id
      ) s ON s.referrer_user_id = u.id
      WHERE EXISTS (SELECT 1 FROM users c WHERE c.referred_by_user_id = u.id)
      ORDER BY COALESCE(s.total_earned, 0) DESC, invited DESC
      LIMIT 200
    `)).rows;
    return { totals: t, pool: poolInfo, referrers };
  } catch (err) {
    if (err.code === '42P01' || err.code === '42703') return empty; // app server hasn't created the tables/columns yet
    throw err;
  }
}

// The words a person is shown (in-app notification AND phone push) when an admin acts on their reward.
// One place, so the notification list, the push, and the reason on the reward row always say the same thing.
function referralNotice(row, kind) {
  if (kind === 'paid') {
    return {
      icon: '🎁',
      title: `Reward paid — ₹${row.amount}`,
      body: `₹${row.amount} has been sent to ${row.claim_upi_id}${row.payout_ref ? ` (payment ref ${row.payout_ref})` : ''}. Thanks for spreading the word!`,
    };
  }
  if (kind === 'rejected') {
    return {
      icon: 'ℹ️',
      title: 'Referral reward not approved',
      body: row.review_note ? `We couldn't approve this reward: ${row.review_note}` : "We couldn't approve this reward after review.",
    };
  }
  // reopened
  return {
    icon: '🎁',
    title: 'Your referral reward is back in review',
    body: `We're taking another look at your ₹${row.amount} reward. You'll hear from us again soon.`,
  };
}

async function findUserPushToken(userId) {
  const { rows } = await pool.query('SELECT push_token FROM users WHERE id = $1', [userId]);
  return rows[0] ? rows[0].push_token : null;
}

// Only a 'claimed' reward can be closed, and only once — the status guard in the UPDATE makes a
// double-click or two admins reviewing at once harmless (the second finds nothing to change). Marking a
// reward paid records the payment reference (UPI transaction/UTR number) so every payout can be traced
// back to a real bank movement; that reference is also shown to the person it was paid to.
async function reviewReferralReward(id, status, note, payoutRef) {
  if (!['paid', 'rejected'].includes(status)) throw new Error('Invalid status');
  const { rows } = await pool.query(
    "UPDATE referral_rewards SET status = $2, reviewed_at = now(), review_note = $3, payout_ref = $4 WHERE id = $1 AND status = 'claimed' RETURNING *",
    [id, status, note || null, status === 'paid' ? (payoutRef || null) : null]
  );
  const row = rows[0];
  if (!row) return null;
  const n = referralNotice(row, status);
  await pool.query(
    'INSERT INTO notifications (user_id, icon, title, subtitle, always_sound) VALUES ($1, $2, $3, $4, true)',
    [row.referrer_user_id, n.icon, n.title, n.body]
  );
  return row;
}

// Undo for a wrongly rejected reward: puts it back in the "awaiting payout" queue as if just claimed, keeping
// the UPI ID the person originally gave. Only a 'rejected' reward can be reopened (a paid one is money already
// sent), and the UPDATE's own guard means two admins clicking at once can't reopen it twice. The earlier
// rejection reason is kept in prior_rejection_note for the record, and cleared from review_note so the person
// isn't shown a stale "not eligible" reason next to a reward that is back in review.
async function reopenReferralReward(id) {
  const { rows } = await pool.query(`
    UPDATE referral_rewards
    SET status = 'claimed', prior_rejection_note = review_note, review_note = NULL, reviewed_at = NULL, reopened_at = now()
    WHERE id = $1 AND status = 'rejected'
    RETURNING *
  `, [id]);
  const row = rows[0];
  if (!row) return null;
  const n = referralNotice(row, 'reopened');
  await pool.query(
    'INSERT INTO notifications (user_id, icon, title, subtitle, always_sound) VALUES ($1, $2, $3, $4, true)',
    [row.referrer_user_id, n.icon, n.title, n.body]
  );
  return row;
}

/* ─────────────────────────── Fraud cases ─────────────────────────── */

async function listFraudCases() {
  const { rows } = await pool.query(`
    SELECT f.*, u.name AS user_name, u.mobile, u.email, u.status AS user_status
    FROM fraud_cases f JOIN users u ON u.id = f.user_id
    ORDER BY f.detected_at DESC
  `);
  return rows;
}

async function createFraudCase({ userId, type, severity, evidence, signal }) {
  const { rows } = await pool.query(
    `INSERT INTO fraud_cases (user_id, type, severity, evidence, signal) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, severity || 'Medium', evidence || null, signal || null]
  );
  return rows[0];
}

async function updateFraudStatus(id, status) {
  const { rows } = await pool.query('UPDATE fraud_cases SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  return rows[0];
}

// One real heuristic against real data: a burst of gift_records from the same owner in a short
// window, compared against the "Max gift entries per minute" figure on the Settings > Fraud
// Detection Rules screen (previously stored but never actually read by anything). Run on demand
// from the Fraud & Spam screen's "Scan Now" button rather than a background job, since this
// server has no cron/worker infra — good enough for an admin-triggered check. Skips users who
// already have an open (New/Under Review) case of this same type so re-scanning isn't spammy.
const VELOCITY_WINDOW_MINUTES = 10;
async function scanForFraud() {
  const settings = await getSettings();
  const velocityLimit = Number(settings.fraudRules?.velocity) || 20;

  const { rows: bursts } = await pool.query(`
    SELECT owner_user_id, COUNT(*)::int AS cnt
    FROM gift_records
    WHERE updated_at > now() - interval '${VELOCITY_WINDOW_MINUTES} minutes'
    GROUP BY owner_user_id
    HAVING COUNT(*) >= $1
  `, [velocityLimit]);

  const created = [];
  for (const b of bursts) {
    const { rows: existing } = await pool.query(
      `SELECT id FROM fraud_cases WHERE user_id = $1 AND type = 'Entry velocity spike' AND status IN ('New', 'Under Review')`,
      [b.owner_user_id]
    );
    if (existing.length) continue;
    const rate = (b.cnt / VELOCITY_WINDOW_MINUTES).toFixed(1);
    const row = await createFraudCase({
      userId: b.owner_user_id,
      type: 'Entry velocity spike',
      severity: b.cnt >= velocityLimit * 2 ? 'High' : 'Medium',
      evidence: `${b.cnt} gift records created/updated in the last ${VELOCITY_WINDOW_MINUTES} minutes.`,
      signal: `Entry velocity ${rate}/min vs configured limit ${velocityLimit} per ${VELOCITY_WINDOW_MINUTES} min`,
    });
    created.push(row);
  }
  return created;
}

/* ─────────────────────────── Support tickets ─────────────────────────── */

async function listTickets() {
  const { rows } = await pool.query(`
    SELECT t.*, u.name AS user_name, a.name AS assigned_name, a.role AS assigned_role
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN admins a ON a.id = t.assigned_admin_id
    ORDER BY t.created_at DESC
  `);
  return rows;
}

async function createTicket({ userId, category, priority, assignedAdminId, description }) {
  const { rows } = await pool.query(
    `INSERT INTO support_tickets (user_id, category, priority, assigned_admin_id, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, category, priority || 'Medium', assignedAdminId || null, description || null]
  );
  return rows[0];
}

async function updateTicket(id, { status, assignedAdminId }) {
  const { rows } = await pool.query(
    `UPDATE support_tickets SET status = COALESCE($2, status), assigned_admin_id = COALESCE($3, assigned_admin_id) WHERE id = $1 RETURNING *`,
    [id, status || null, assignedAdminId || null]
  );
  return rows[0];
}

/* ─────────────────────────── Ads ─────────────────────────── */

async function listAds() {
  const { rows } = await pool.query(`
    SELECT ad.*,
      (SELECT array_agg(u.name) FROM users u WHERE u.id = ANY(ad.target_user_ids)) AS target_user_names
    FROM ads ad
    ORDER BY ad.created_at DESC
  `);
  return rows;
}

async function createAd({ title, body, eventType, targetUserIds, placement, status, image, linkUrl, maxPerDay, dateMode, from, to, targetStates, targetDistricts }) {
  const { rows } = await pool.query(
    `INSERT INTO ads (title, body, event_type, target_user_ids, placement, status, image, link_url, max_per_day, date_mode, from_date, to_date, target_states, target_districts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [title, body || null, eventType || 'All types', targetUserIds || null, placement || 'Event page banner', status || 'Draft', image || null, linkUrl || null, maxPerDay || null, dateMode || 'All dates', from || null, to || null, targetStates || null, targetDistricts || null]
  );
  return rows[0];
}

async function updateAdStatus(id, status) {
  const { rows } = await pool.query('UPDATE ads SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  return rows[0];
}

async function deleteAd(id) {
  await pool.query('DELETE FROM ads WHERE id = $1', [id]);
}

/* ─────────────────────────── Content: FAQs & announcements ─────────────────────────── */

async function listFaqs() {
  const { rows } = await pool.query('SELECT * FROM faqs ORDER BY created_at DESC');
  return rows;
}
async function createFaq({ title, category }) {
  const { rows } = await pool.query('INSERT INTO faqs (title, category) VALUES ($1, $2) RETURNING *', [title, category || 'General']);
  return rows[0];
}
async function toggleFaqPublished(id) {
  const { rows } = await pool.query('UPDATE faqs SET published = NOT published WHERE id = $1 RETURNING *', [id]);
  return rows[0];
}
async function deleteFaq(id) { await pool.query('DELETE FROM faqs WHERE id = $1', [id]); }

async function listAnnouncements() {
  const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
  return rows;
}
async function createAnnouncement({ title, placement }) {
  const { rows } = await pool.query('INSERT INTO announcements (title, placement) VALUES ($1, $2) RETURNING *', [title, placement || 'Home banner']);
  return rows[0];
}
async function toggleAnnouncementActive(id) {
  const { rows } = await pool.query('UPDATE announcements SET active = NOT active WHERE id = $1 RETURNING *', [id]);
  return rows[0];
}
async function deleteAnnouncement(id) { await pool.query('DELETE FROM announcements WHERE id = $1', [id]); }

/* ─────────────────────────── Settings ─────────────────────────── */

async function getSettings() {
  const { rows } = await pool.query('SELECT * FROM app_settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
async function updateSetting(key, value) {
  await pool.query(
    'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, JSON.stringify(value)]
  );
  return value;
}

/* ─────────────────────────── Dashboard ─────────────────────────── */

async function getDashboardKpis() {
  const [
    { rows: userCounts }, { rows: activeCounts }, { rows: eventCount }, { rows: giftAgg },
    { rows: paidCount }, { rows: fraudOpen },
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM users`),
    pool.query(`SELECT COUNT(DISTINCT user_id)::int AS n FROM sessions WHERE last_seen_at > now() - interval '30 days'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM events`),
    pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::bigint AS total FROM gift_records`),
    pool.query(`SELECT COUNT(DISTINCT user_id)::int AS n FROM subscriptions WHERE status = 'Active' AND package_id <> 'regular'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM fraud_cases WHERE status IN ('New', 'Under Review')`),
  ]);
  return {
    totalUsers: userCounts[0].n,
    activeUsers: activeCounts[0].n,
    totalEvents: eventCount[0].n,
    giftsRecorded: giftAgg[0].n,
    totalGiftValue: Number(giftAgg[0].total),
    paidSubscribers: paidCount[0].n,
    openFraudCases: fraudOpen[0].n,
  };
}

async function getMonthlySeries() {
  const [{ rows: signups }, { rows: activeByMonth }, { rows: eventsByMonth }, { rows: giftsByMonth }, { rows: revenueByMonth }, { rows: eventTypes }] = await Promise.all([
    pool.query(`SELECT date_trunc('month', created_at) AS m, COUNT(*)::int AS n FROM users GROUP BY m ORDER BY m`),
    pool.query(`SELECT date_trunc('month', last_seen_at) AS m, COUNT(DISTINCT user_id)::int AS n FROM sessions GROUP BY m ORDER BY m`),
    pool.query(`SELECT date_trunc('month', updated_at) AS m, COUNT(*)::int AS n FROM events GROUP BY m ORDER BY m`),
    pool.query(`SELECT date_trunc('month', updated_at) AS m, COALESCE(SUM(amount), 0)::bigint AS total FROM gift_records GROUP BY m ORDER BY m`),
    pool.query(`SELECT date_trunc('month', activated_at) AS m, COALESCE(SUM(amount), 0)::bigint AS total FROM subscriptions GROUP BY m ORDER BY m`),
    pool.query(`SELECT COALESCE(NULLIF(type, ''), 'Others') AS type, COUNT(*)::int AS n FROM events GROUP BY type ORDER BY n DESC`),
  ]);
  return { signups, activeByMonth, eventsByMonth, giftsByMonth, revenueByMonth, eventTypes };
}

// "Coming soon" interest, written by the app (feature_interest table, created by the app server). Always returns every
// known feature, with zeros when nobody has looked yet or the table does not exist yet.
const INTEREST_FEATURES = [
  { id: 'pay', label: 'Pay' },
  { id: 'bills', label: 'Bills' },
  { id: 'vendors', label: 'Vendors' },
];
async function getFeatureInterest() {
  const base = INTEREST_FEATURES.map((f) => ({ ...f, tapped: 0, notify: 0, tapped7d: 0, notify7d: 0, daily: Array(14).fill(0), recent: [] }));
  const empty = { totalUsers: 0, distinctTapped: 0, distinctNotify: 0, features: base };
  try {
    const totalUsers = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    const d = (await pool.query(`SELECT count(DISTINCT user_id)::int AS tapped, count(DISTINCT user_id) FILTER (WHERE notify)::int AS notify FROM feature_interest`)).rows[0];
    const per = (await pool.query(`
      SELECT feature,
             count(*)::int AS tapped,
             count(*) FILTER (WHERE notify)::int AS notify,
             count(*) FILTER (WHERE tapped_at > now() - interval '7 days')::int AS tapped7d,
             count(*) FILTER (WHERE notify AND notify_at > now() - interval '7 days')::int AS notify7d
      FROM feature_interest GROUP BY feature`)).rows;
    const daily = (await pool.query(`
      SELECT feature, (now()::date - notify_at::date)::int AS ago, count(*)::int AS n
      FROM feature_interest WHERE notify AND notify_at > now() - interval '14 days' GROUP BY 1, 2`)).rows;
    const recent = (await pool.query(`
      SELECT fi.feature, fi.notify_at, u.id, u.name, u.mobile, u.state, u.district
      FROM feature_interest fi JOIN users u ON u.id = fi.user_id
      WHERE fi.notify ORDER BY fi.notify_at DESC LIMIT 300`)).rows;
    for (const f of base) {
      const p = per.find((r) => r.feature === f.id); if (p) Object.assign(f, { tapped: p.tapped, notify: p.notify, tapped7d: p.tapped7d, notify7d: p.notify7d });
      daily.filter((r) => r.feature === f.id && r.ago >= 0 && r.ago < 14).forEach((r) => { f.daily[13 - r.ago] = r.n; });
      f.recent = recent.filter((r) => r.feature === f.id).slice(0, 25).map((r) => ({ userId: r.id, name: r.name, mobile: r.mobile, place: [r.district, r.state].filter(Boolean).join(', '), at: r.notify_at }));
    }
    return { totalUsers, distinctTapped: d.tapped, distinctNotify: d.notify, features: base };
  } catch (err) {
    console.error('getFeatureInterest failed (feature_interest table not created yet?):', err.message);
    return empty;
  }
}

module.exports = {
  pool, init,
  hashPassword, verifyPassword,
  findAdminByEmail, findAdminById, createAdminSession, findAdminByToken, deleteAdminSession,
  listAdmins, createAdmin, updateAdmin, toggleAdminTfa, setAdminTfaSecret, deleteAdmin, toPublicAdmin,
  logAudit, listAuditLogs,
  listUsers, countUsers, getUserDetail, setUserStatus, listPushTokensForAudience,
  createScheduledNotification, listScheduledNotifications, listDueScheduledNotifications,
  markScheduledNotificationSent, markScheduledNotificationFailed, cancelScheduledNotification,
  listEvents,
  listGifts, setGiftStatus,
  listFamilies, countFamilies, removeFamilyMember, addFamilyMember,
  listPackages, updatePackage,
  listSubscriptions, createSubscription, updateSubscriptionStatus,
  listFeedback, updateFeedbackStatus, getFeatureInterest,
  listReferralRewards, getReferralSummary, reviewReferralReward, reopenReferralReward, referralNotice, findUserPushToken,
  listFraudCases, createFraudCase, updateFraudStatus, scanForFraud,
  listTickets, createTicket, updateTicket,
  listAds, createAd, updateAdStatus, deleteAd,
  listFaqs, createFaq, toggleFaqPublished, deleteFaq,
  listAnnouncements, createAnnouncement, toggleAnnouncementActive, deleteAnnouncement,
  getSettings, updateSetting,
  getDashboardKpis, getMonthlySeries,
  MENU_IDS,
};
