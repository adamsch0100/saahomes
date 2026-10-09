import test from 'node:test';
import assert from 'node:assert/strict';
import logger from '../utils/logger.js';

// isConfigured() reads these at import time — set them before importing the
// module so the sync functions run instead of short-circuiting.
process.env.R2_ACCOUNT_ID = 'test-account';
process.env.R2_PUBLIC_URL = 'https://photos.example.com';
process.env.R2_API_TOKEN = 'test-token';

const {
  isDownloadAbortError,
  isPhotoDegradedError,
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
