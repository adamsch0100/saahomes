#!/usr/bin/env node
/**
 * IndexNow — submit the 8 money URLs to Bing and the other IndexNow engines.
 *
 * IndexNow verifies ownership by fetching the key file at
 *   https://saahomes.com/<key>.txt
 * so the key file (public/<key>.txt) has to be live before a submission is
 * accepted. This script checks the live key first and exits non-zero when it is
 * missing, so a run before deploy fails loudly instead of silently no-oping.
 *
 * Written for the SEO fix fix-38377-15. The shared endpoint
 * https://api.indexnow.org/indexnow fans out to every participating engine
 * (Bing, Yandex, Seznam, Naver); https://www.bing.com/indexnow is the direct
 * fallback if the shared endpoint is down.
 *
 * Usage:
 *   npm run indexnow                       # submit the money URLs
 *   node scripts/submit-indexnow.mjs --dry-run   # print payload, no network
 *
 * Env:
 *   INDEXNOW_KEY   override the key (defaults to the committed public key file)
 *   SITE_URL       override the host (defaults to https://saahomes.com)
 */

const SITE_URL = (process.env.SITE_URL || 'https://saahomes.com').replace(/\/+$/, '');
const HOST = new URL(SITE_URL).host;

// The 8 money URLs — canonical P0 money paths. Kept in step with
// scripts/indexation_patrol.py (P0_PATHS, non-area) and SITE_MONEY_PAGES in
// scripts/prerender-meta.mjs.
const MONEY_PATHS = [
  '/',
  '/for-buyers/',
  '/for-sellers/',
  '/contact/',
  '/properties/',
  '/chfa-down-payment-assistance/',
  '/chfa-schools-to-home/',
  '/colorado-champions-home-loan-program/',
];

const KEY = process.env.INDEXNOW_KEY || 'dcb3e94b2a7bfa9d81019c0e5e6268c4';
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;

const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
];

const dryRun = process.argv.includes('--dry-run');

async function keyIsLive() {
  const res = await fetch(KEY_LOCATION, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return false;
  return (await res.text()).trim() === KEY;
}

async function post(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  return res.status;
}

async function main() {
  const urlList = MONEY_PATHS.map((p) => `${SITE_URL}${p}`);
  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

  console.log(`IndexNow: ${urlList.length} money URLs for ${HOST}`);
  for (const url of urlList) console.log(`  ${url}`);

  if (dryRun) {
    console.log('\n--dry-run: payload that would be POSTed:');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\nChecking key file ${KEY_LOCATION} ...`);
  if (!(await keyIsLive())) {
    console.error(`FAIL: key file missing or content mismatch — deploy public/${KEY}.txt first.`);
    process.exit(1);
  }
  console.log('  key file verified.');

  for (const endpoint of ENDPOINTS) {
    try {
      const status = await post(endpoint, payload);
      console.log(`  POST ${endpoint} -> HTTP ${status}`);
      if (status === 200 || status === 202) {
        console.log('\nIndexNow submission accepted.');
        return;
      }
    } catch (err) {
      console.error(`  POST ${endpoint} -> error: ${err.message}`);
    }
  }

  console.error('\nFAIL: no IndexNow endpoint accepted the submission.');
  process.exit(1);
}

main().catch((err) => {
  console.error(`submit-indexnow failed: ${err.message}`);
  process.exit(1);
});
