/**
 * The notify repair: one 200 four-leg sheet (`GET /api/notify-health`) that
 * never skips a dead leg, and a per-submit log that records all four legs plus
 * minutes-to-human. The board event hook is the no-key human notice; its
 * delivery stamps the clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

const waitFor = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

test('notify-health answers 200 with a four-leg sheet and the last submit leg log', { skip: !hasTestDatabase }, async (t) => {
  // FUB unconfigured, no GA4 secret, no mail credential: the two dead legs must
  // print red with their measured value, never be skipped.
  delete process.env.FOLLOW_UP_BOSS_API_KEY;
  delete process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;
  delete process.env.GA4_API_SECRET;
  delete process.env.GA4_MEASUREMENT_API_SECRET;
  delete process.env.OUTREACH_SMTP_HOST;
  delete process.env.OUTREACH_SMTP_USER;
  delete process.env.OUTREACH_SMTP_PASSWORD;
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
    // Board hook + anything else: answered ok so the board leg is delivered.
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const db = await createTestDatabase();
  t.after(db.drop);
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.url}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Notify Test',
      email: 'notify.test@comcast.net',
      phone: '9705550100',
      interest: 'buying',
      message: 'Labeled notify-health test',
      sourcePage: '/contact/',
    }),
  });
  assert.equal(res.status, 201, JSON.stringify(await res.json().catch(() => ({}))));

  const health = await fetch(`${server.url}/api/notify-health`);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body.legs).sort(), ['board', 'fub', 'ga4', 'mail']);
  for (const [name, leg] of Object.entries(body.legs)) {
    assert.ok(['ok', 'red'].includes(leg.status), `${name} leg must be ok|red`);
    assert.ok(leg.detail, `${name} leg must carry a detail`);
  }
  assert.equal(body.legs.fub.status, 'red');
  assert.equal(body.legs.fub.detail, 'not_configured');
  assert.equal(body.legs.ga4.status, 'red');
  assert.equal(body.legs.mail.mailTest.status, 503);

  // The async legs write within a beat; the board hook delivered stamps the clock.
  assert.ok(await waitFor(async () => {
    const { rows } = await db.pool.query(
      'SELECT board_result, human_notified_at, minutes_to_human FROM lead_submit_log ORDER BY id DESC LIMIT 1'
    );
    return rows[0]?.board_result === 'delivered';
  }), 'board leg was not recorded as delivered');

  const { rows } = await db.pool.query(
    `SELECT submission_id, ga4_fired, fub_result, notify_result, board_result,
            human_notified_at, minutes_to_human
       FROM lead_submit_log ORDER BY id DESC LIMIT 1`
  );
  const row = rows[0];
  assert.ok(row.submission_id, 'log row must carry the submission id');
  assert.equal(row.board_result, 'delivered');
  assert.equal(row.fub_result, 'failed');
  assert.ok(row.human_notified_at, 'a delivered board event is a human touch');
  assert.ok(Number(row.minutes_to_human) < 5, 'human touch must land under 5 minutes');

  const last = body.lastSubmit;
  assert.ok(last, 'lastSubmit must be present');
  for (const leg of ['board', 'fub', 'ga4', 'mail']) {
    assert.ok(leg in last, `lastSubmit must carry the ${leg} leg`);
  }
  assert.equal(last.submission_id, row.submission_id);
});
