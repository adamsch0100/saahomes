/**
 * Walls between brokerages. A second brokerage, on its own domain, tries every
 * route it can reach — as an admin, an agent and a buyer, with SAA's own ids
 * and tokens plugged into every URL — and must never see or change SAA data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-walls';

const PEAK = 'peak-realty.test';
const MARK = /saaonly/i; // every SAA row below carries this word
const token = () => crypto.randomBytes(24).toString('hex');

let db;
let server;
let peak; // tenant 2
let saa = {}; // SAA ids and tokens to plug into Peak's requests

test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const q = (sql, p) => db.pool.query(sql, p);

  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain) VALUES ('peak', 'Peak Realty', $1) RETURNING *",
    [PEAK]
  ));

  // ── SAA (tenant 1): a full set of data, all marked ──
  const user = async (email, name, extra = {}) => {
    const cols = ['email', 'name', 'manage_token', 'status', ...Object.keys(extra)];
    const vals = [email, name, token(), 'active', ...Object.values(extra)];
    const { rows } = await q(
      `INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  };
  const agentA = await user('saaonly-agent@saahomes.test', 'Saaonly Agent', { role: 'agent' });
  const buyer = await user('shared@example.com', 'Saaonly Buyer', { phone: '9705550111', assigned_agent_id: agentA.id, lifecycle_stage: 'active' });
  const pondLead = await user('saaonly-pond@example.com', 'Saaonly Pond');
  const home = await insertListing(db.pool, { city: 'Windsor' });

  const { rows: [search] } = await q(
    "INSERT INTO saved_searches (user_id, name, filters) VALUES ($1, 'Saaonly search', '{\"city\":\"Windsor\"}') RETURNING *",
    [buyer.id]
  );
  await q("INSERT INTO saved_homes (user_id, listing_key, property_address) VALUES ($1, $2, 'Saaonly Home')", [buyer.id, home.listing_id]);
  await q("INSERT INTO home_reactions (user_id, listing_key, reaction, note) VALUES ($1, $2, 'love', 'saaonly note')", [buyer.id, home.listing_id]);
  const { rows: [household] } = await q("INSERT INTO households (name) VALUES ('Saaonly household') RETURNING *");
  await q('UPDATE users SET household_id = $1 WHERE id = $2', [household.id, buyer.id]);
  const { rows: [comment] } = await q(
    "INSERT INTO home_comments (household_id, listing_key, user_id, body) VALUES ($1, $2, $3, 'saaonly comment') RETURNING *",
    [household.id, home.listing_id, buyer.id]
  );
  const { rows: [invite] } = await q(
    "INSERT INTO household_invites (household_id, invited_by, email, name, token_hash, expires_at) VALUES ($1, $2, 'saaonly-partner@example.com', 'Saaonly Partner', $3, NOW() + INTERVAL '7 days') RETURNING *",
    [household.id, buyer.id, crypto.createHash('sha256').update('x').digest('hex')]
  );
  const { rows: [tour] } = await q(
    "INSERT INTO tour_requests (user_id, listing_keys, windows, note) VALUES ($1, $2, '[]', 'saaonly tour') RETURNING *",
    [buyer.id, [home.listing_id]]
  );
  const { rows: [note] } = await q(
    "INSERT INTO notifications (user_id, type, title) VALUES ($1, 'new_listing', 'Saaonly alert') RETURNING *",
    [buyer.id]
  );
  const { rows: [profile] } = await q(
    "INSERT INTO home_profiles (user_id, address_line, city) VALUES ($1, '1 Saaonly Ln', 'Windsor') RETURNING *",
    [buyer.id]
  );
  const { rows: [contact] } = await q(
    "INSERT INTO contact_submissions (name, email, message) VALUES ('Saaonly Contact', 'saaonly-contact@example.com', 'saaonly') RETURNING *"
  );
  await q(
    "INSERT INTO showing_requests (name, email, showing_date, showing_time) VALUES ('Saaonly Showing', 'saaonly-show@example.com', CURRENT_DATE, '10:00')"
  );
  await q("INSERT INTO events (user_id, type, listing_id, meta) VALUES ($1, 'search', NULL, '{\"asked\":\"saaonly words\"}')", [buyer.id]);
  await q("INSERT INTO events (user_id, type, listing_id) VALUES ($1, 'listing_view', $2)", [buyer.id, home.listing_id]);

  saa = {
    ids: [buyer.id, pondLead.id, agentA.id, search.id, household.id, comment.id, invite.id, tour.id, note.id, profile.id, contact.id],
    tokens: [buyer.manage_token],
    keys: [home.listing_id],
    buyer, agentA, pondLead, search,
  };

  // ── Peak (tenant 2): its own staff and a buyer with the SAME email as SAA's buyer ──
  const peakUser = async (email, name, role = 'client') => {
    const { rows } = await q(
      "INSERT INTO users (email, name, role, manage_token, status, tenant_id) VALUES ($1, $2, $3, $4, 'active', $5) RETURNING *",
      [email, name, role, token(), peak.id]
    );
    return rows[0];
  };
  peak.admin = await peakUser('owner@peak-realty.test', 'Pat Owner', 'admin');
  peak.agent = await peakUser('agent@peak-realty.test', 'Avery Agent', 'agent');
  peak.buyer = await peakUser('shared@example.com', 'Peak Buyer');
});

test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

/** Every row SAA owns, hashed, so any write from Peak shows up as a change. */
async function saaFingerprint() {
  const tables = [
    'users', 'saved_searches', 'saved_homes', 'home_reactions', 'households', 'home_comments',
    'household_invites', 'tour_requests', 'notifications', 'home_profiles', 'contact_submissions',
    'showing_requests', 'events', 'email_outbox', 'email_log',
  ];
  const parts = [];
  for (const t of tables) {
    const { rows } = await db.pool.query(
      `SELECT md5(COALESCE(string_agg(md5(x::text), ',' ORDER BY x.id), '')) AS h FROM ${t} x WHERE tenant_id = 1`
    );
    parts.push(`${t}:${rows[0].h}`);
  }
  return parts.join('|');
}

async function call(method, path, { auth, cookie, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(cookie ? { Cookie: `saa_user_token=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
}

async function routesOf(file) {
  const { default: router } = await import(`../src/routes/${file}`);
  const out = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) out.push({ method: method.toUpperCase(), path: layer.route.path });
  }
  return out;
}

/** Every way to fill a route's params with SAA's ids, tokens and keys. */
function fill(path) {
  const names = [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
  if (!names.length) return [path];
  const values = [...saa.ids.map(String), ...saa.tokens, ...saa.keys, 'contact', 'showing'];
  const out = new Set();
  for (const v of values) out.add(path.replace(/:(\w+)/g, (_, n) => (n === 'type' ? 'contact' : v)));
  return [...out];
}

// Routes that start outside work (MLS/FUB syncs, cron, mail) or only serve
// public listing data are not a way into another brokerage's people.
const SKIP = /^\/(cron|mail-test|listings|sold-listings|photo|schools|push\/key|email\/open|sync-fub-lifecycle|fub\/import)/;

test('the same email is two different people at two brokerages', { skip: !hasTestDatabase }, async () => {
  const { rows } = await db.pool.query("SELECT tenant_id, name FROM users WHERE email = 'shared@example.com' ORDER BY tenant_id");
  assert.deepEqual(rows.map((r) => r.tenant_id), [1, peak.id]);

  // Signing in on Peak's domain with that email reaches Peak's person, never SAA's.
  const r = await call('POST', '/auth/session', { body: { email: 'shared@example.com', phone: '9705550199', name: 'Peak Buyer' } });
  assert.ok(r.status < 500, r.text);
  assert.doesNotMatch(r.text, MARK);
  const { rows: [saaBuyer] } = await db.pool.query('SELECT phone FROM users WHERE id = $1', [saa.buyer.id]);
  assert.equal(saaBuyer.phone, '9705550111', "SAA's buyer is untouched");
});

test("one brokerage's sign-in doesn't work at another", { skip: !hasTestDatabase }, async () => {
  const { generateToken } = await import('../src/middleware/auth.js');
  const peakAgent = generateToken({ id: peak.agent.id, email: peak.agent.email, role: 'agent', tenant_id: peak.id });
  const saaAgent = generateToken({ id: saa.agentA.id, email: saa.agentA.email, role: 'agent', tenant_id: 1 });
  const legacy = generateToken({ id: saa.agentA.id, email: saa.agentA.email, role: 'agent' }); // issued before tenants

  assert.equal((await call('GET', '/agent/cockpit', { auth: peakAgent, host: 'saahomes.com' })).status, 403);
  assert.equal((await call('GET', '/agent/cockpit', { auth: saaAgent })).status, 403);
  assert.equal((await call('GET', '/agent/cockpit', { auth: legacy })).status, 403);
  assert.equal((await call('GET', '/agent/cockpit', { auth: legacy, host: 'saahomes.com' })).status, 200, 'old SAA tokens keep working on SAA');

  // A buyer's link or cookie from SAA finds nobody at Peak.
  for (const path of ['/alerts/me', `/alerts/manage?token=${saa.buyer.manage_token}`, '/saved-homes', '/household', '/notifications']) {
    const r = await call('GET', path, { cookie: saa.buyer.manage_token });
    assert.doesNotMatch(r.text, MARK, `${path} answered with SAA data`);
  }
});

test("Peak's admin, agent and buyer can't read or change SAA data through any route", { skip: !hasTestDatabase }, async () => {
  const { generateToken } = await import('../src/middleware/auth.js');
  const as = {
    admin: generateToken({ id: peak.admin.id, email: peak.admin.email, role: 'admin', tenant_id: peak.id }),
    agent: generateToken({ id: peak.agent.id, email: peak.agent.email, role: 'agent', tenant_id: peak.id }),
  };
  const before = await saaFingerprint();
  const leaks = [];
  const tried = { admin: 0, agent: 0, buyer: 0 };

  const sweep = async (who, prefix, routes, opts) => {
    for (const { method, path } of routes) {
      if (path === '/login' || SKIP.test(path)) continue;
      for (const filled of fill(path)) {
        const body = method === 'GET' || method === 'DELETE' ? undefined : {
          id: saa.buyer.id, userId: saa.buyer.id, user_id: saa.buyer.id, leadId: saa.buyer.id, lead_id: saa.buyer.id,
          agent_id: peak.agent.id, email: saa.buyer.email, token: saa.buyer.manage_token, stage: 'lost', name: 'Hijack',
          listing_key: saa.keys[0], listingId: saa.keys[0], searchId: saa.search.id,
        };
        // Sign-outs and unsubscribes along the way must not end the sweep early.
        await db.pool.query(
          "UPDATE users SET status = 'active', manage_token = $2 WHERE id = $1",
          [peak.buyer.id, peak.buyer.manage_token]
        );
        const r = await call(method, `${prefix}${filled}`, { ...opts, body });
        tried[who] += 1;
        if (process.env.WALLS_DEBUG) console.log('SWEEP', who, method, `${prefix}${filled}`, r.status);
        if (MARK.test(r.text)) leaks.push(`${who} ${method} ${prefix}${filled} → ${r.status} ${r.text.slice(0, 160)}`);
      }
    }
  };
  await sweep('admin', '/admin', await routesOf('admin.js'), { auth: as.admin });
  await sweep('agent', '/agent', await routesOf('agent.js'), { auth: as.agent });
  await sweep('buyer', '', await routesOf('api.js'), { cookie: peak.buyer.manage_token });

  assert.deepEqual(leaks, [], `SAA data reached Peak:\n${leaks.join('\n')}`);
  assert.equal(await saaFingerprint(), before, "a Peak request changed SAA's data");
  assert.ok(tried.admin > 40 && tried.agent >= 20 && tried.buyer > 60, JSON.stringify(tried));
});

test('agents see their own leads and, by default, the shared pond', { skip: !hasTestDatabase }, async () => {
  const { generateToken } = await import('../src/middleware/auth.js');
  const q = (sql, p) => db.pool.query(sql, p);
  const { rows: [agentB] } = await q(
    "INSERT INTO users (email, name, role, manage_token, status) VALUES ('saaonly-agent-b@saahomes.test', 'Saaonly Bee', 'agent', $1, 'active') RETURNING *",
    [token()]
  );
  const asB = generateToken({ id: agentB.id, email: agentB.email, role: 'agent', tenant_id: 1 });
  const names = async () => {
    const r = await call('GET', '/agent/cockpit?limit=200', { auth: asB, host: 'saahomes.com' });
    assert.equal(r.status, 200, r.text);
    return JSON.stringify(r.json);
  };

  // SAA keeps its old "everyone sees every lead"; a new brokerage's default is
  // each agent's own leads plus the unassigned pond.
  const { clearTenantCache } = await import('../src/services/tenantContext.js');
  assert.match(await names(), /Saaonly Buyer/, 'SAA agents still see every lead');
  await q("UPDATE tenants SET settings = settings - 'lead_visibility' WHERE id = 1");
  clearTenantCache();

  let seen = await names();
  assert.match(seen, /Saaonly Pond/, 'unassigned leads are in the shared pond');
  assert.doesNotMatch(seen, /Saaonly Buyer/, "another agent's lead stays hidden");

  await q("UPDATE tenants SET settings = settings || '{\"lead_visibility\":\"own\"}' WHERE id = 1");
  clearTenantCache();
  seen = await names();
  assert.doesNotMatch(seen, /Saaonly Pond/, "with 'own', the pond is hidden too");

  const r = await call('PATCH', `/agent/cockpit/${saa.buyer.id}`, { auth: asB, host: 'saahomes.com', body: { stage: 'lost' } });
  assert.ok([403, 404].includes(r.status), `agent B changed agent A's lead: ${r.status}`);
  await q("UPDATE tenants SET settings = settings || '{\"lead_visibility\":\"all\"}' WHERE id = 1");
  clearTenantCache();
});
