/**
 * The lead pipeline must never break: a website form lands in Postgres and is
 * forwarded to Follow Up Boss. Follow Up Boss is stubbed at the fetch layer.
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

test('contact form is stored and sent to Follow Up Boss', { skip: !hasTestDatabase }, async (t) => {
  process.env.FOLLOW_UP_BOSS_API_KEY = 'test-key';
  delete process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;

  const realFetch = globalThis.fetch;
  const fubCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
    if (url.startsWith('https://api.followupboss.com/')) {
      fubCalls.push({ url, body: init.body ? JSON.parse(init.body) : null });
      return new Response(JSON.stringify({ id: 101, personId: 202 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
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
      name: 'Pat Buyer',
      email: 'pat.buyer@comcast.net',
      phone: '9705551234',
      interest: 'buying',
      message: 'Looking in Fort Collins',
      sourcePage: '/northern-colorado-areas/fort-collins/',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));

  const stored = await db.pool.query('SELECT name, email, source_page FROM contact_submissions');
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].email, 'pat.buyer@comcast.net');
  assert.equal(stored.rows[0].source_page, '/northern-colorado-areas/fort-collins/');

  assert.ok(await waitFor(() => fubCalls.some((c) => c.url.endsWith('/v1/events'))), 'no Follow Up Boss event sent');
  const event = fubCalls.find((c) => c.url.endsWith('/v1/events')).body;
  assert.equal(event.type, 'General Inquiry');
  assert.equal(event.person.emails[0].value, 'pat.buyer@comcast.net');
  assert.equal(event.person.firstName, 'Pat');
});
