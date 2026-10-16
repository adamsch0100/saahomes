/**
 * Fort Collins above-the-fold capture (commit 8800a32) — one labeled submit
 * through the real endpoint, read back as a stored row that carries the label.
 *
 * The Fort Collins area page mounts
 *   <AreaMarketReportCapture areaName="Fort Collins, CO" captureLabel="fort-collins-above-fold" />
 * whose submit posts the four fields plus sourcePage
 *   /northern-colorado-areas/fort-collins/?capture=fort-collins-above-fold
 * to POST /api/market-report. This runs the real Express route and the real
 * controller against a throwaway database and asserts the row that lands keeps
 * that source_page, so a live submit is traceable to this block and the counter
 * is not the proof. Skips cleanly when no test database is configured.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-market-report';
process.env.CRM_SCHEDULER = 'off';
process.env.ACTION_PLAN_SCHEDULER = 'off';
process.env.ACTION_PLAN_KICK = 'off';
process.env.HOT_LEAD_ALERTS = 'off';

const CAPTURE_LABEL = 'fort-collins-above-fold';
const PAGE_PATH = '/northern-colorado-areas/fort-collins/';
const SOURCE_PAGE = `${PAGE_PATH}?capture=${CAPTURE_LABEL}`;
const skip = !hasTestDatabase;

let db;
let server;

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('the Fort Collins above-fold capture stores a market_report row carrying its label', { skip }, async () => {
  const res = await fetch(`${server.url}/api/market-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Loop',
      lastName: 'Probe',
      email: 'loop.probe@example.invalid',
      phone: '9705550140',
      area: 'Fort Collins, CO',
      sourcePage: SOURCE_PAGE,
      landingPage: PAGE_PATH,
      referrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    }),
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }

  assert.equal(res.status, 201, text);
  assert.equal(json?.success, true, text);
  assert.ok(json?.id, `the endpoint returns the stored row id: ${text}`);

  const { rows } = await db.pool.query(
    'SELECT id, area, source_page, email FROM market_report_submissions WHERE id = $1',
    [json.id]
  );
  assert.equal(rows.length, 1, 'one stored row for the labeled submit');
  assert.equal(rows[0].source_page, SOURCE_PAGE, 'the stored row carries capture=fort-collins-above-fold');
  assert.equal(rows[0].area, 'Fort Collins, CO');
});
