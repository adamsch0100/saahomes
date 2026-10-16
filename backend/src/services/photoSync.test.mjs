import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import logger from '../utils/logger.js';

// isConfigured() reads these at import time — set them before importing the
// module so the sync functions run instead of short-circuiting.
process.env.R2_ACCOUNT_ID = 'test-account';
process.env.R2_PUBLIC_URL = 'https://photos.example.com';
process.env.R2_API_TOKEN = 'test-token';

const {
  isDownloadAbortError,
  isPhotoDegradedError,
  isRetryableUploadStatus,
  PhotoDegradedError,
  syncListingPhotos,
} = await import('./photoSync.js');

test('isDownloadAbortError flags DOMException timeout/abort failures', () => {
  assert.equal(isDownloadAbortError(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), true);
  assert.equal(isDownloadAbortError(new DOMException('aborted', 'AbortError')), true);
  assert.equal(isDownloadAbortError(Object.assign(new Error('x'), { name: 'TimeoutError' })), true);
  const aborted = new Error('aborted');
  aborted.cause = { code: 'ABORT_ERR' };
  assert.equal(isDownloadAbortError(aborted), true);
  assert.equal(isDownloadAbortError(Object.assign(new Error('HTTP 500'), { status: 500 })), false);
  assert.equal(isDownloadAbortError(undefined), false);
});

test('isPhotoDegradedError covers our typed degradation and raw aborts', () => {
  assert.equal(isPhotoDegradedError(new PhotoDegradedError('timed out')), true);
  assert.equal(isPhotoDegradedError(new DOMException('aborted due to timeout', 'TimeoutError')), true);
  assert.equal(isPhotoDegradedError(new Error('HTTP 500')), false);
  assert.equal(isPhotoDegradedError(undefined), false);
});

// Keep the 1s/call CDN pacing out of the unit test run.
process.env.SITE_URL = process.env.SITE_URL || 'https://saahomes.com';

test('a timed-out photo download is deferred (warn), never logged as a failure', async () => {
  const originalFetch = global.fetch;
  const warns = [];
  const errors = [];
  const originalWarn = logger.warn;
  const originalError = logger.error;
  logger.warn = (m) => warns.push(m);
  logger.error = (m) => errors.push(m);
  global.fetch = async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };
  try {
    const out = await syncListingPhotos(
      { id: 42, listing_id: 'IRE42', slug: 'test-slug' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.equal(errors.length, 0, 'an upstream timeout must not be an incident-level failure');
    assert.ok(warns.some((m) => /deferred \(upstream slow\)/.test(m)), 'must warn that it was deferred');
  } finally {
    global.fetch = originalFetch;
    logger.warn = originalWarn;
    logger.error = originalError;
  }
});

test('the proxy placeholder (200 + x-photo-fallback) is deferred, not stored', async () => {
  const originalFetch = global.fetch;
  const warns = [];
  const errors = [];
  const originalWarn = logger.warn;
  const originalError = logger.error;
  logger.warn = (m) => warns.push(m);
  logger.error = (m) => errors.push(m);
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (k) => (k.toLowerCase() === 'x-photo-fallback' ? '1' : null) },
  });
  try {
    const out = await syncListingPhotos(
      { id: 43, listing_id: 'IRE43', slug: 'test-slug-2' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.equal(errors.length, 0, 'a placeholder must not be an incident-level failure');
    assert.ok(warns.some((m) => /placeholder/.test(m)), 'must warn about the placeholder');
  } finally {
    global.fetch = originalFetch;
    logger.warn = originalWarn;
    logger.error = originalError;
  }
});

test('a genuine upstream error still logs at failure level', async () => {
  const originalFetch = global.fetch;
  const warns = [];
  const errors = [];
  const originalWarn = logger.warn;
  const originalError = logger.error;
  logger.warn = (m) => warns.push(m);
  logger.error = (m) => errors.push(m);
  global.fetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => null },
  });
  try {
    const out = await syncListingPhotos(
      { id: 44, listing_id: 'IRE44', slug: 'test-slug-3' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.ok(errors.some((m) => /failed/.test(m)), 'a real error must still log as a failure');
  } finally {
    global.fetch = originalFetch;
    logger.warn = originalWarn;
    logger.error = originalError;
  }
});

// --- Transient gateway failures from the photo proxy (incident inc-6bb77347)
// The proxy answers 502/503/504 when the upstream photo host is briefly
// unavailable. The sync must defer those (warn) so the next sweep retries,
// never log them as incident-level failures.

test('a 502 from the photo proxy is deferred, not an incident-level failure', async () => {
  const originalFetch = global.fetch;
  const warns = [];
  const errors = [];
  const originalWarn = logger.warn;
  const originalError = logger.error;
  logger.warn = (m) => warns.push(m);
  logger.error = (m) => errors.push(m);
  global.fetch = async () => ({
    ok: false,
    status: 502,
    headers: { get: () => null },
  });
  try {
    const out = await syncListingPhotos(
      { id: 48, listing_id: 'IRE48', slug: 'gateway-slug' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.equal(errors.length, 0, 'a transient gateway 502 must not raise an incident');
    assert.ok(warns.some((m) => /deferred \(upstream slow\)/.test(m)), 'must warn it was deferred');
  } finally {
    global.fetch = originalFetch;
    logger.warn = originalWarn;
    logger.error = originalError;
  }
});

// --- R2 REST upload resilience (incident inc-a1e0a274) ---------------------
// Cloudflare returns HTTP 500 / code 10001 (InternalError) transiently and
// documents "Retry the request". The raw-fetch REST path must retry those
// instead of permanently failing the photo.

const TINY_PNG = await sharp({
  create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 120, b: 90 } },
}).png().toBuffer();

/** Serve a real image for downloads; simulate R2 uploads by status. */
function installFetch(uploadStatusFor) {
  const originalFetch = global.fetch;
  const uploadUrls = [];
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.cloudflare.com')) {
      uploadUrls.push(u);
      const status = uploadStatusFor(uploadUrls.length);
      if (status >= 400) {
        return {
          ok: false,
          status,
          text: async () =>
            '{"success":false,"errors":[{"code":10001,"message":"We encountered an internal error. Please try again."}],"messages":[]}',
        };
      }
      return { ok: true, status: 200, text: async () => '{}' };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => TINY_PNG,
    };
  };
  return { uploadUrls, restore: () => { global.fetch = originalFetch; } };
}

function captureLogs() {
  const warns = [];
  const errors = [];
  const originalWarn = logger.warn;
  const originalError = logger.error;
  logger.warn = (m) => warns.push(m);
  logger.error = (m) => errors.push(m);
  return { warns, errors, restore: () => { logger.warn = originalWarn; logger.error = originalError; } };
}

test('isRetryableUploadStatus retries 5xx and 429, not 4xx', () => {
  assert.equal(isRetryableUploadStatus(500), true);
  assert.equal(isRetryableUploadStatus(503), true);
  assert.equal(isRetryableUploadStatus(429), true);
  assert.equal(isRetryableUploadStatus(401), false);
  assert.equal(isRetryableUploadStatus(403), false);
  assert.equal(isRetryableUploadStatus(400), false);
});

test('a transient R2 500 is retried and the photo still stores', async () => {
  const logs = captureLogs();
  const fetchMock = installFetch((n) => (n <= 2 ? 500 : 200));
  try {
    const out = await syncListingPhotos(
      { id: 45, listing_id: 'IRE45', slug: 'retry-slug' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.ok(Array.isArray(out) && out.length === 1, 'photo must store after a retried transient 500');
    assert.equal(logs.errors.length, 0, 'a retried transient 500 must not log an incident');
    assert.ok(
      fetchMock.uploadUrls.filter((u) => u.includes('retry-slug')).length >= 3,
      'the first attempts were retried',
    );
  } finally {
    fetchMock.restore();
    logs.restore();
  }
});

test('a persistent R2 500 is deferred, not an incident-level failure', async () => {
  const logs = captureLogs();
  const fetchMock = installFetch(() => 500);
  try {
    const out = await syncListingPhotos(
      { id: 46, listing_id: 'IRE46', slug: 'persistent-slug' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.equal(logs.errors.length, 0, 'an upstream R2 5xx must not be an incident after retries');
    assert.ok(logs.warns.some((m) => /deferred \(upstream slow\)/.test(m)), 'must warn it was deferred');
  } finally {
    fetchMock.restore();
    logs.restore();
  }
});

test('a non-retryable R2 403 fails hard and is not retried', async () => {
  const logs = captureLogs();
  const fetchMock = installFetch(() => 403);
  try {
    const out = await syncListingPhotos(
      { id: 47, listing_id: 'IRE47', slug: 'forbidden-slug' },
      ['https://media.mlsgrid.com/photo.jpg?expires=1'],
    );
    assert.equal(out, null);
    assert.ok(logs.errors.some((m) => /R2 REST upload 403/.test(m)), 'a bad credential must surface as a failure');
    assert.equal(
      fetchMock.uploadUrls.filter((u) => u.includes('forbidden-slug')).length,
      2,
      'one attempt per object key, no retry on 403',
    );
  } finally {
    fetchMock.restore();
    logs.restore();
  }
});
