import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

let db;
let server;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

async function signedIn(email, name) {
  const b = browser(server.url);
  const r = await b.post('/alerts', { email, contact_name: name, city: 'Loveland' });
  assert.equal(r.status, 201, r.text);
  const { rows } = await db.pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return { b, user: rows[0] };
}

async function inviteLinkTo(email) {
  const { rows } = await db.pool.query(
    'SELECT html FROM email_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1', [email]
  );
  const m = rows[0]?.html.match(/\/board\/\?join=([a-f0-9]{48})/);
  assert.ok(m, 'invite email with a join link');
  return m[1];
}

let pat;
let jamie;
let homeA;
let homeB;

test('a buyer invites a co-buyer, who joins from the emailed link', { skip: !hasTestDatabase }, async () => {
  assert.equal((await browser(server.url).post('/household/invite', { email: 'x@comcast.net' })).status, 401);

  pat = await signedIn('pat.buyer@comcast.net', 'Pat Buyer');
  homeA = await insertListing(db.pool, { city: 'Loveland' });
  homeB = await insertListing(db.pool, { city: 'Loveland' });
  await pat.b.put(`/reactions/${homeA.listing_id}`, { reaction: 'love', note: 'Pat only: tiny yard' });

  assert.equal((await pat.b.post('/household/invite', { email: 'pat.buyer@comcast.net' })).status, 400);
  const r = await pat.b.post('/household/invite', { email: 'Jamie.Lee@comcast.net', name: 'Jamie Lee' });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.invite.email, 'jamie.lee@comcast.net');
  assert.ok(!JSON.stringify(r.json).match(/[a-f0-9]{48}/), 'the token never goes back to the inviter');

  const hh = (await pat.b.get('/household')).json.data;
  assert.equal(hh.invites.length, 1);
  assert.match(hh.household.name, /Pat's home search/);

  const token = await inviteLinkTo('jamie.lee@comcast.net');
  const stored = await db.pool.query('SELECT token_hash FROM household_invites');
  assert.notEqual(stored.rows[0].token_hash, token, 'stored hashed');

  const jb = browser(server.url);
  const j = await jb.post('/household/join', { token });
  assert.equal(j.status, 200, j.text);
  assert.equal(j.json.data.new_account, true);
  assert.ok(jb.jar.has('saa_user_token'));
  assert.equal((await browser(server.url).post('/household/join', { token })).status, 410, 'single use');

  jamie = { b: jb, user: (await db.pool.query("SELECT * FROM users WHERE email = 'jamie.lee@comcast.net'")).rows[0] };
  assert.equal(jamie.user.name, 'Jamie Lee');
  assert.equal(jamie.user.household_id, (await db.pool.query('SELECT household_id FROM users WHERE id = $1', [pat.user.id])).rows[0].household_id);

  const n = await db.pool.query("SELECT title FROM notifications WHERE user_id = $1 AND type = 'board'", [pat.user.id]);
  assert.deepEqual(n.rows.map((x) => x.title), ['Jamie joined your home search']);
});

test('the board shows everyone\'s homes and reactions, but not private notes', { skip: !hasTestDatabase }, async () => {
  await jamie.b.put(`/reactions/${homeB.listing_id}`, { reaction: 'maybe' });
  await jamie.b.put(`/reactions/${homeA.listing_id}`, { reaction: 'love', note: 'Jamie only: love the porch' });

  const board = (await pat.b.get('/board')).json.data;
  assert.equal(board.shared, true);
  assert.deepEqual(board.members.map((m) => m.first_name), ['Pat', 'Jamie']);
  const a = board.homes.find((h) => h.listing_key === homeA.listing_id);
  const b = board.homes.find((h) => h.listing_key === homeB.listing_id);
  assert.deepEqual(a.people.map((p) => p.reaction), ['love', 'love']);
  assert.equal(a.everyone_loves, true);
  assert.deepEqual(b.people.map((p) => [p.first_name, p.saved, p.reaction]), [['Pat', false, null], ['Jamie', true, 'maybe']]);
  assert.equal(b.everyone_loves, false);
  assert.doesNotMatch(JSON.stringify(board), /tiny yard|porch/);
});

test('comments reach the other buyer and the agent', { skip: !hasTestDatabase }, async () => {
  const outsider = await signedIn('solo.buyer@comcast.net', 'Solo Buyer');
  assert.equal((await outsider.b.post(`/board/${homeA.listing_id}/comments`, { body: 'hi' })).status, 400);
  assert.equal((await jamie.b.post(`/board/${homeA.listing_id}/comments`, { body: '   ' })).status, 400);

  const c = await jamie.b.post(`/board/${homeA.slug}/comments`, { body: 'Could we see this Saturday?' });
  assert.equal(c.status, 201, c.text);
  const board = (await pat.b.get('/board')).json.data;
  const thread = board.homes.find((h) => h.listing_key === homeA.listing_id).comments;
  assert.deepEqual(thread.map((t) => [t.author, t.mine, t.body]), [['Jamie', false, 'Could we see this Saturday?']]);
  assert.equal(board.homes[0].listing_key, homeA.listing_id, 'latest activity first');

  const n = await db.pool.query(
    "SELECT title, body, link FROM notifications WHERE user_id = $1 AND type = 'board' ORDER BY id DESC LIMIT 1", [pat.user.id]
  );
  assert.equal(n.rows[0].title, `Jamie commented on ${homeA.street_number} Test St`);
  assert.equal(n.rows[0].link, `/board/#home-${homeA.listing_id}`);

  // The agent's Follow Up Boss timeline gets the comment as a note.
  await db.pool.query('UPDATE users SET fub_person_id = 501 WHERE id = $1', [jamie.user.id]);
  const { addFollowUpBossNote } = await import('../src/services/followUpBossService.js');
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true }; };
  const r = await addFollowUpBossNote(jamie.user.id, { subject: 'Comment on 1 Test St', body: 'Could we see this Saturday?' },
    { pool: db.pool, fetchImpl, apiKey: 'k' });
  assert.equal(r.ok, true);
  assert.equal(calls[0].url, 'https://api.followupboss.com/v1/notes');
  assert.deepEqual(calls[0].body, { personId: 501, subject: 'Comment on 1 Test St', body: 'Could we see this Saturday?', isHtml: false });

  // The cockpit names the co-buyer.
  const { enrichLeadForCockpit } = await import('../src/services/agentCockpit.js');
  const { rows: [patRow] } = await db.pool.query('SELECT * FROM users WHERE id = $1', [pat.user.id]);
  const lead = await enrichLeadForCockpit(patRow, {}, db.pool);
  assert.deepEqual(lead.household, {
    co_buyers: [{ id: jamie.user.id, name: 'Jamie Lee', email: 'jamie.lee@comcast.net' }],
    comments: 1,
  });
});

test('staff seats and cancelled invites cannot be used to sign in', { skip: !hasTestDatabase }, async () => {
  await db.pool.query(
    "INSERT INTO users (email, name, manage_token, role) VALUES ('agent.seat@saahomes.com', 'Agent Seat', 'agenttoken0000000000000000000000', 'agent')"
  );
  assert.equal((await pat.b.post('/household/invite', { email: 'agent.seat@saahomes.com' })).status, 201);
  const staffToken = await inviteLinkTo('agent.seat@saahomes.com');
  const sb = browser(server.url);
  const s = await sb.post('/household/join', { token: staffToken });
  assert.equal(s.status, 403);
  assert.equal(s.json.signInRequired, true);
  assert.ok(!sb.jar.has('saa_user_token'));

  assert.equal((await pat.b.post('/household/invite', { email: 'third@comcast.net' })).status, 201);
  const third = await inviteLinkTo('third@comcast.net');
  const pending = (await pat.b.get('/household')).json.data.invites.find((i) => i.email === 'third@comcast.net');
  assert.equal((await jamie.b.del(`/household/invites/${pending.id}`)).status, 200);
  assert.equal((await browser(server.url).post('/household/join', { token: third })).status, 410);

  assert.equal((await jamie.b.post('/household/leave', {})).status, 200);
  const board = (await pat.b.get('/board')).json.data;
  assert.equal(board.shared, false);
});
