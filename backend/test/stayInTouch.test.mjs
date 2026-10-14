/**
 * Stay in touch after closing: closing facts set the schedule, each email
 * goes out once in the brokerage's brand, unsubscribes are per kind, nearby
 * home alerts are capped per month, owner signals reach the agent, and no
 * brokerage ever sees another's clients.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-stay';

const PEAK = 'peak-stay.test';
const SAA = 'saahomes.com';
const SAA_STRINGS = /saahomes|SAA Homes|999-1407|Schwartz|CFB36E/i;
const skip = !hasTestDatabase;

// Midday on a given date (the same date in Mountain time); runs are forced past the 9am gate.
const midday = (ymd) => new Date(`${ymd}T18:00:00Z`);

// ------------------------------------------------------------ pure rules

test('closing facts are checked before they are saved', async () => {
  const { cleanClosingFacts } = await import('../src/services/stayInTouch.js');
  assert.match(cleanClosingFacts({ close_date: '2026-01-02' }, '2026-10-14').error, /address/);
  assert.match(cleanClosingFacts({ address_line: '1 Elm', close_date: 'soon' }, '2026-10-14').error, /closing date/);
  assert.match(cleanClosingFacts({ address_line: '1 Elm', close_date: '2026-03-02', birthday: '02-30' }, '2026-10-14').error, /real month/);
  const { facts } = cleanClosingFacts({
    address_line: ' 12 Elm St ', close_date: '2025-06-15', close_price: '$512,000', birthday: '1980-02-29', stay_in_touch: true, target_rate: '5.75',
  }, '2026-10-14');
  assert.equal(facts.address_line, '12 Elm St');
  assert.equal(facts.close_price, 512000);
  assert.deepEqual([facts.birthday_month, facts.birthday_day], [2, 29]);
  assert.equal(facts.target_rate, 5.75);
  assert.equal(facts.side, 'buyer');
});

test('each kind is due on its day, once, and only when it is on', async () => {
  const { dueKinds } = await import('../src/services/stayInTouch.js');
  const closing = { stay_in_touch: true, side: 'buyer', close_date: '2025-06-15', birthday_month: 3, birthday_day: 4, target_rate: 6 };
  const base = { prefs: {}, sent: new Set(), settings: { tax_enabled: true, tax_month: 5 }, rate: null, templateApproved: true };
  const kinds = (today, state = base) => dueKinds(closing, today, state).map((d) => d.kind);

  assert.deepEqual(kinds('2026-06-14'), []);
  assert.deepEqual(dueKinds(closing, '2026-06-15', base), [{ kind: 'anniversary', period: '2026', years: 1 }]);
  assert.deepEqual(kinds('2026-06-20'), ['anniversary'], 'a missed day still sends within a week');
  assert.deepEqual(kinds('2026-06-25'), []);
  assert.deepEqual(kinds('2026-06-15', { ...base, sent: new Set(['anniversary:2026']) }), [], 'once a year');
  assert.deepEqual(kinds('2025-06-15'), [], 'no anniversary on closing day itself');

  assert.deepEqual(kinds('2026-03-04'), ['birthday']);
  assert.deepEqual(kinds('2026-03-04', { ...base, templateApproved: false }), [], 'birthday waits for the agent’s approved note');
  assert.deepEqual(kinds('2026-05-02'), ['tax']);
  assert.deepEqual(kinds('2026-05-02', { ...base, settings: { tax_enabled: false } }), []);
  assert.deepEqual(kinds('2025-05-20'), [], 'no tax note before they owned the home');

  assert.deepEqual(kinds('2026-08-01', { ...base, rate: { rate: 6.4 } }), []);
  assert.deepEqual(kinds('2026-08-01', { ...base, rate: { rate: 5.9 } }), ['rate']);
  assert.deepEqual(kinds('2026-08-01', { ...base, rate: null }), [], 'rate watch is off without a rate source');

  assert.deepEqual(kinds('2026-06-15', { ...base, prefs: { anniversary: { client_off: true } } }), [], 'client unsubscribed');
  assert.deepEqual(kinds('2026-03-04', { ...base, prefs: { birthday: { agent_off: true } } }), [], 'agent turned it off');
  assert.deepEqual(dueKinds({ ...closing, stay_in_touch: false }, '2026-06-15', base), [], 'no consent, no emails');
  assert.deepEqual(dueKinds({ ...closing, side: 'seller' }, '2026-06-15', base).map((d) => d.kind), [], 'a client who sold gets no home reports');
});

test('the daily pass runs once a day, on the 9am Mountain tick', async () => {
  const { runStayInTouch } = await import('../src/services/stayInTouch.js');
  assert.deepEqual(await runStayInTouch({ now: new Date('2026-10-14T21:57:00Z') }), { skipped: 'not_stay_hour', sent: 0 });
});

test('the schedule shows what each client gets next', async () => {
  const { planFor } = await import('../src/services/stayInTouch.js');
  const closing = { stay_in_touch: true, side: 'buyer', close_date: '2026-09-30', birthday_month: null, target_rate: null };
  const plan = planFor(closing, '2026-10-14', { prefs: { neighbor: { client_off: true } }, sent: new Set(), settings: { tax_enabled: true, tax_month: 5 }, rate: null, templateApproved: false });
  const by = Object.fromEntries(plan.map((p) => [p.kind, p]));
  assert.equal(by.anniversary.next_on, '2027-09-30');
  assert.equal(by.anniversary.detail, 'First report');
  assert.equal(by.tax.next_on, '2027-05-01');
  assert.equal(by.birthday.status, 'not_set_up');
  assert.equal(by.neighbor.status, 'off_by_client');
  assert.equal(by.rate.status, 'not_set_up');
});

test('equity uses a standard loan balance', async () => {
  const { loanBalance } = await import('../src/services/stayInTouch.js');
  assert.equal(Math.round(loanBalance(400000, 6, 30, 0)), 400000);
  assert.equal(Math.round(loanBalance(400000, 6, 30, 12)), 395088);
  assert.equal(loanBalance(400000, 6, 30, 360), 0);
});

test('seller intent is scored from what the owner did', async () => {
  const { scoreSellerIntent, levelOf, mentionsSelling } = await import('../src/services/sellerSignals.js');
  const none = scoreSellerIntent({ valueViews: 0, compsBuilt: 0, anniversaryOpens: 0, nadiaSelling: 0, marketAnalysis: 0, savedElsewhere: 0, ownsHome: true, yearsOwned: 2 });
  assert.equal(none.score, 0);
  const hot = scoreSellerIntent({ valueViews: 4, compsBuilt: 1, anniversaryOpens: 1, nadiaSelling: 1, marketAnalysis: 0, savedElsewhere: 3, ownsHome: true, yearsOwned: 6 });
  assert.equal(levelOf(hot.score), 'likely');
  assert.ok(hot.reasons.includes('Asked Nadia about selling'));
  assert.ok(hot.reasons.some((r) => /Saved 3 homes while owning one/.test(r)));
  assert.ok(hot.reasons.some((r) => /Owned their home 6 years/.test(r)));
  const buyer = scoreSellerIntent({ valueViews: 0, compsBuilt: 0, anniversaryOpens: 0, nadiaSelling: 0, marketAnalysis: 0, savedElsewhere: 5, ownsHome: false, yearsOwned: 0 });
  assert.equal(buyer.score, 0, 'saving homes is not a seller signal for someone who owns nothing');
  assert.ok(mentionsSelling('We are thinking about selling next spring'));
  assert.ok(mentionsSelling("what's my house worth?"));
  assert.ok(!mentionsSelling('why are they selling this one?'));
  assert.ok(!mentionsSelling('show me 3 bed homes in Windsor'));
});

// ------------------------------------------------------------ end to end
let db;
let server;
let peak;
const people = {};
const tokens = {};

async function call(method, path, { auth, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
}

const sent = [];
const capture = async (to, subject, html, fromName, opts) => { sent.push({ to, subject, html, fromName, opts }); };
const sentTo = (email, kind) => sent.filter((s) => s.to === email && (!kind || s.kind === kind));

async function run(ymd) {
  const before = sent.length;
  const { runStayInTouch } = await import('../src/services/stayInTouch.js');
  const out = await runStayInTouch({ now: midday(ymd), force: true, send: capture, pool: db.pool, rate: null, fubPush: async () => {} });
  // label what was sent this run by kind from the claim rows
  const { rows } = await db.pool.query('SELECT s.kind, s.subject, u.email FROM stay_touch_sends s JOIN users u ON u.id = s.user_id ORDER BY s.id');
  for (const s of sent.slice(before)) s.kind = rows.find((r) => r.subject === s.subject && r.email === s.to)?.kind;
  return out;
}

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const q = (sql, p) => db.pool.query(sql, p);
  ({ rows: [peak] } = await q(
    `INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peakstay', 'Peak Realty', $1, $2) RETURNING *`,
    [PEAK, JSON.stringify({ brand: { name: 'Peak Realty', phone: '303-555-0100', accent_color: '#2255aa' }, lead_visibility: 'own' })]
  ));
  // Peak's MLS approved its site, so it shows live IRES homes and sales.
  await q(`INSERT INTO tenant_feeds (tenant_id, feed_key, status, sold_enabled) VALUES ($1, 'ires', 'approved', TRUE)`, [peak.id]);
  const mk = async (key, email, name, role, tenantId, extra = {}) => {
    const { rows: [u] } = await q(
      `INSERT INTO users (email, name, role, status, manage_token, tenant_id, assigned_agent_id)
       VALUES ($1, $2, $3, 'active', $4, $5, $6) RETURNING *`,
      [email, name, role, crypto.randomBytes(24).toString('hex'), tenantId, extra.assigned || null]
    );
    people[key] = u;
    return u;
  };
  await mk('owner', 'olive@peak-stay.test', 'Olive Owner', 'admin', peak.id);
  await mk('agent', 'andy@peak-stay.test', 'Andy Agent', 'agent', peak.id);
  await mk('agent2', 'bea@peak-stay.test', 'Bea Broker', 'agent', peak.id);
  await mk('client', 'casey@example.com', 'Casey Client', 'client', peak.id, { assigned: people.agent.id });
  await mk('client2', 'drew@example.com', 'Drew Doe', 'client', peak.id, { assigned: people.agent.id });
  await mk('saaAgent', 'sam@saahomes.test', 'Sam SAA', 'agent', 1);
  await mk('saaClient', 'casey@example.com', 'Casey at SAA', 'client', 1, { assigned: people.saaAgent.id });
  const { generateToken } = await import('../src/middleware/auth.js');
  tokens.owner = generateToken({ id: people.owner.id, email: people.owner.email, role: 'admin', tenant_id: peak.id });
  tokens.agent = generateToken({ id: people.agent.id, email: people.agent.email, role: 'agent', tenant_id: peak.id });
  tokens.agent2 = generateToken({ id: people.agent2.id, email: people.agent2.email, role: 'agent', tenant_id: peak.id });
  tokens.saa = generateToken({ id: people.saaAgent.id, email: people.saaAgent.email, role: 'agent', tenant_id: 1 });
  // Enough active listings for a value estimate in the client's ZIP.
  for (let i = 0; i < 6; i += 1) {
    await insertListing(db.pool, {
      postal_code: '80525', city: 'Fort Collins', list_price: 520000 + i * 1000, living_area: 2000, price_per_sqft: 260 + i, days_on_market: 90, created_at: '2025-01-01',
    });
  }
  await q(
    `INSERT INTO sold_listings (listing_id, city, postal_code, street_number, street_name, beds, baths, living_area, sold_price, closed_date)
     VALUES ('S-OLD', 'Fort Collins', '80525', '9', 'Old Rd', 3, 2, 1900, 480000, '2026-01-10')`
  );
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('an agent records closing facts; the client is closed, owns the home on My Home and the schedule starts', { skip }, async () => {
  const facts = {
    address_line: '12 Elm St', city: 'Fort Collins', postal_code: '80525', close_date: '2025-06-15', close_price: 500000,
    loan_amount: 400000, loan_rate: 6, loan_years: 30, birthday: '03-04', stay_in_touch: true, agent_note: 'Still love that porch!',
  };
  assert.equal((await call('POST', `/agent/clients/${people.client.id}/closing`, { body: facts })).status, 401);
  assert.equal((await call('POST', `/agent/clients/${people.client.id}/closing`, { auth: tokens.agent2, body: facts })).status, 404, 'another agent’s client');
  assert.equal((await call('POST', `/agent/clients/${people.client.id}/closing`, { auth: tokens.saa, body: facts })).status, 403, 'another brokerage’s token');
  assert.equal((await call('POST', `/agent/clients/${people.saaClient.id}/closing`, { auth: tokens.agent, body: facts, host: SAA })).status, 403);
  const saved = await call('POST', `/agent/clients/${people.client.id}/closing`, { auth: tokens.agent, body: facts });
  assert.equal(saved.status, 201, saved.text);
  assert.equal(saved.json.data.closing.birthday, '03-04');

  const { rows: [u] } = await db.pool.query('SELECT lifecycle_stage, lifecycle_stage_manual FROM users WHERE id = $1', [people.client.id]);
  assert.equal(u.lifecycle_stage, 'closed');
  const { rows: homes } = await db.pool.query('SELECT address_line, tenant_id FROM home_profiles WHERE user_id = $1', [people.client.id]);
  assert.deepEqual(homes, [{ address_line: '12 Elm St', tenant_id: peak.id }]);
  const { rows: consent } = await db.pool.query("SELECT status, tenant_id FROM contact_consents WHERE user_id = $1 AND source = 'closing_facts'", [people.client.id]);
  assert.deepEqual(consent, [{ status: 'granted', tenant_id: peak.id }]);

  const list = await call('GET', '/agent/stay', { auth: tokens.agent });
  assert.equal(list.status, 200, list.text);
  const row = list.json.data.items.find((i) => i.user_id === people.client.id);
  const plan = Object.fromEntries(row.plan.map((p) => [p.kind, p]));
  assert.match(plan.anniversary.next_on, /^\d{4}-06-15$/);
  assert.equal(plan.birthday.status, 'not_set_up', 'waits for the agent’s birthday note');
  assert.equal(plan.tax.status, 'not_set_up', 'Peak has not picked a tax month');
  assert.equal(plan.rate.status, 'not_set_up');

  // Other agents and other brokerages never see this client.
  assert.equal((await call('GET', '/agent/stay', { auth: tokens.agent2 })).json.data.items.length, 0);
  assert.equal((await call('GET', '/agent/stay', { auth: tokens.saa, host: SAA })).json.data.items.length, 0);
  assert.equal((await call('GET', '/agent/stay', { auth: tokens.owner })).json.data.items.length, 1, 'the owner sees every client');
});

test('owners pick the tax month; agents approve their own birthday note', { skip }, async () => {
  assert.equal((await call('PUT', '/agent/stay/settings', { auth: tokens.agent, body: { tax_month: 5 } })).status, 403);
  const set = await call('PUT', '/agent/stay/settings', { auth: tokens.owner, body: { tax_month: 5 } });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.data.tax_month, 5);
  const { rows: [saa] } = await db.pool.query('SELECT settings FROM tenants WHERE id = 1');
  assert.equal(saa.settings.stay_in_touch, undefined, 'SAA’s settings are untouched');

  const t = await call('GET', '/agent/stay/template', { auth: tokens.agent });
  assert.equal(t.json.data.approved, false);
  const ok = await call('PUT', '/agent/stay/template', { auth: tokens.agent, body: { subject: 'Happy birthday, {first_name}!', body: 'Have a great one, {first_name}. — {agent_name}', approve: true } });
  assert.equal(ok.json.data.approved, true);

  const list = await call('GET', '/agent/stay', { auth: tokens.agent });
  const plan = Object.fromEntries(list.json.data.items[0].plan.map((p) => [p.kind, p]));
  assert.equal(plan.birthday.status, 'scheduled');
  assert.match(plan.birthday.next_on, /-03-04$/);
  assert.match(plan.tax.next_on, /-05-01$/);
});

test('the anniversary report goes out once, in the brokerage’s brand, with value, equity and neighborhood sales', { skip }, async () => {
  const preview = await call('GET', `/agent/stay/${people.client.id}/preview/anniversary`, { auth: tokens.agent });
  assert.equal(preview.status, 200, preview.text);
  assert.match(preview.json.data.html, /PEAK REALTY/);
  assert.doesNotMatch(preview.json.data.html, SAA_STRINGS);
  assert.equal((await call('GET', `/agent/stay/${people.client.id}/preview/anniversary`, { auth: tokens.agent2 })).status, 404);

  await run('2026-06-14');
  assert.equal(sentTo('casey@example.com').length, 0, 'not before the day');
  await run('2026-06-15');
  const [report] = sentTo('casey@example.com', 'anniversary');
  assert.ok(report, 'anniversary sent');
  assert.match(report.subject, /one-year home anniversary, Casey/);
  assert.match(report.html, /Estimated value today/);
  assert.match(report.html, /Estimated equity/);
  assert.match(report.html, /ZIP 80525/);
  assert.match(report.html, /Still love that porch!/);
  assert.match(report.html, /Andy Agent/);
  assert.match(report.html, /stop=anniversary/);
  assert.match(report.html, new RegExp(`https://${PEAK.replace('.', '\\.')}/my-home/`));
  assert.doesNotMatch(report.html, SAA_STRINGS);
  assert.equal(report.opts.tenantId, peak.id);
  assert.equal(report.opts.replyTo, 'andy@peak-stay.test');
  await run('2026-06-16');
  assert.equal(sentTo('casey@example.com', 'anniversary').length, 1, 'never twice in a year');
  const { rows: log } = await db.pool.query("SELECT tenant_id FROM email_log WHERE type = 'stay_anniversary'");
  assert.deepEqual(log.map((r) => r.tenant_id), [peak.id]);
});

test('a client can stop one kind from the email link; the others keep coming', { skip }, async () => {
  const client = people.client;
  const me = await call('GET', `/stay/me?token=${client.manage_token}`);
  assert.equal(me.status, 200, me.text);
  assert.ok(me.json.data.kinds.find((k) => k.kind === 'anniversary').on);
  assert.equal((await call('GET', `/stay/me?token=${client.manage_token}`, { host: SAA })).status, 401, 'a token works only at its own brokerage');
  const off = await call('PUT', `/stay/me?token=${client.manage_token}`, { body: { kind: 'anniversary', on: false } });
  assert.equal(off.json.data.kinds.find((k) => k.kind === 'anniversary').on, false);

  await run('2027-03-04');
  assert.equal(sentTo('casey@example.com', 'birthday').length, 1, 'birthday still comes');
  assert.match(sentTo('casey@example.com', 'birthday')[0].html, /Have a great one, Casey\. — Andy Agent/);
  await run('2027-05-03');
  assert.equal(sentTo('casey@example.com', 'tax').length, 1, 'tax season note in the owner’s month');
  assert.match(sentTo('casey@example.com', 'tax')[0].html, /not legal or tax advice/);
  await run('2027-06-15');
  assert.equal(sentTo('casey@example.com', 'anniversary').length, 1, 'no second anniversary after unsubscribing');

  // The agent can turn one off too.
  const p = await call('PATCH', `/agent/stay/${client.id}`, { auth: tokens.agent, body: { kind: 'birthday', on: false } });
  assert.equal(p.json.data.plan.find((x) => x.kind === 'birthday').status, 'off_by_agent');
  await run('2028-03-04');
  assert.equal(sentTo('casey@example.com', 'birthday').length, 1);
});

test('nearby sales alerts are capped per month and never repeat a home', { skip }, async () => {
  for (let i = 0; i < 4; i += 1) {
    await db.pool.query(
      `INSERT INTO sold_listings (listing_id, city, postal_code, street_number, street_name, beds, baths, living_area, sold_price, closed_date)
       VALUES ($1, 'Fort Collins', '80525', $2, 'Oak St', 3, 2, 1950, $3, '2028-08-02')`,
      [`S-N${i}`, String(20 + i), 510000 + i * 5000]
    );
  }
  for (const day of ['2028-08-03', '2028-08-04', '2028-08-05', '2028-08-06']) await run(day);
  const august = sentTo('casey@example.com', 'neighbor');
  const { NEIGHBOR_MONTHLY_CAP } = await import('../src/services/stayInTouch.js');
  assert.equal(august.length, NEIGHBOR_MONTHLY_CAP);
  assert.match(august[0].subject, /sold for \$5/);
  await run('2028-09-01');
  const all = sentTo('casey@example.com', 'neighbor');
  assert.equal(all.length, NEIGHBOR_MONTHLY_CAP + 1, 'a new month, one more');
  const { rows } = await db.pool.query("SELECT period_key FROM stay_touch_sends WHERE kind = 'neighbor'");
  assert.equal(new Set(rows.map((r) => r.period_key)).size, rows.length, 'each home once');
});

test('nobody who did not agree to stay in touch gets anything', { skip }, async () => {
  const r = await call('POST', `/agent/clients/${people.client2.id}/closing`, {
    auth: tokens.agent, body: { address_line: '40 Pine', postal_code: '80525', close_date: '2025-07-01', stay_in_touch: false },
  });
  assert.equal(r.status, 201);
  await run('2026-07-01');
  await run('2027-07-01');
  assert.equal(sentTo('drew@example.com').length, 0);
  const list = await call('GET', '/agent/stay', { auth: tokens.agent });
  const row = list.json.data.items.find((i) => i.user_id === people.client2.id);
  assert.ok(row.plan.every((p) => p.status === 'no_consent'));
});

test('an owner who keeps checking their value shows up for their agent and in Follow Up Boss, once', { skip }, async () => {
  const id = people.client.id;
  for (const type of ['home_value_view', 'home_value_view', 'home_value_view', 'comps_adjusted', 'seller_question']) {
    await db.pool.query('INSERT INTO events (tenant_id, user_id, type, occurred_at) VALUES ($1, $2, $3, NOW())', [peak.id, id, type]);
  }
  const { refreshSellerIntent } = await import('../src/services/sellerSignals.js');
  const pushes = [];
  const fubPush = async (user, intent) => pushes.push({ user: user.id, score: intent.score });
  const first = await refreshSellerIntent(id, { pool: db.pool, fubPush });
  assert.equal(first.level, 'likely');
  assert.equal(first.pushed, true);
  const again = await refreshSellerIntent(id, { pool: db.pool, fubPush });
  assert.equal(again.pushed, false, 'not every day');
  assert.equal(pushes.length, 1);

  const { buildBrief } = await import('../src/services/morningBrief.js');
  const brief = await buildBrief({ id: people.agent.id, role: 'agent', tenant_id: peak.id }, { pool: db.pool });
  assert.equal(brief.seller_watch.length, 1);
  assert.equal(brief.seller_watch[0].lead_id, id);
  assert.ok(brief.seller_watch[0].reasons.includes('Asked Nadia about selling'));
  const other = await buildBrief({ id: people.agent2.id, role: 'agent', tenant_id: peak.id }, { pool: db.pool });
  assert.equal(other.seller_watch.length, 0, 'another agent’s client stays theirs');
  const saa = await buildBrief({ id: people.saaAgent.id, role: 'agent', tenant_id: 1 }, { pool: db.pool });
  assert.equal(saa.seller_watch.length, 0, 'another brokerage never sees it');
});

test('a seller-side closing keeps only the personal notes', { skip }, async () => {
  const { kindsForClosing } = await import('../src/services/stayInTouch.js');
  assert.deepEqual(kindsForClosing({ side: 'seller' }), ['birthday', 'rate']);
});
