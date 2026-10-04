import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpiredMlsUrl,
  expiredUrlError,
  isExpectedPhotoDegradation,
  isUpstreamAbortError,
  isUpstreamRateLimitError,
  isValidPhotoId,
  getListingPhotoDefault,
} from './photoController.js';

const nowSec = () => Math.floor(Date.now() / 1000);

test('isExpiredMlsUrl flags a signed MLS URL past its expires= epoch', () => {
  assert.equal(isExpiredMlsUrl(`https://media.mlsgrid.com/a.jpg?expires=${nowSec() - 60}`), true);
});

test('isExpiredMlsUrl leaves a still-valid signed MLS URL alone', () => {
  assert.equal(isExpiredMlsUrl(`https://media.mlsgrid.com/a.jpg?expires=${nowSec() + 3600}`), false);
});

test('isExpiredMlsUrl ignores non-MLS hosts even with an expires param', () => {
  assert.equal(isExpiredMlsUrl(`https://cdn.example.com/a.jpg?expires=${nowSec() - 60}`), false);
});

test('isExpiredMlsUrl ignores an MLS URL with no expires param', () => {
  assert.equal(isExpiredMlsUrl('https://media.mlsgrid.com/a.jpg'), false);
});

test('expiredUrlError carries the control-flow sentinel', () => {
  const err = expiredUrlError();
  assert.equal(err.message, 'photo URL expired (past expires=)');
  assert.equal(isExpectedPhotoDegradation(err), true);
});

test('genuine fetch failures are not classified as expected degradation', () => {
  const err = new Error('photo fetch 500');
  err.status = 500;
  assert.equal(isExpectedPhotoDegradation(err), false);
  assert.equal(isExpectedPhotoDegradation(undefined), false);
});

test('isUpstreamAbortError flags DOMException timeout/abort failures', () => {
  assert.equal(isUpstreamAbortError(new DOMException('aborted due to timeout', 'TimeoutError')), true);
  assert.equal(isUpstreamAbortError(new DOMException('aborted', 'AbortError')), true);
  assert.equal(isUpstreamAbortError(Object.assign(new Error('x'), { name: 'TimeoutError' })), true);
  const aborted = new Error('aborted');
  aborted.cause = { code: 'ABORT_ERR' };
  assert.equal(isUpstreamAbortError(aborted), true);
  assert.equal(isUpstreamAbortError(Object.assign(new Error('photo fetch 500'), { status: 500 })), false);
  assert.equal(isUpstreamAbortError(undefined), false);
});

test('an upstream timeout is expected degradation, not an incident', () => {
  const err = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  assert.equal(isExpectedPhotoDegradation(err), true);
});

test('isUpstreamRateLimitError flags an upstream HTTP 429', () => {
  const direct = Object.assign(new Error('photo fetch 429'), { status: 429 });
  assert.equal(isUpstreamRateLimitError(direct), true);
  const wrapped = new Error('fetch failed');
  wrapped.cause = { status: 429 };
  assert.equal(isUpstreamRateLimitError(wrapped), true);
  assert.equal(isUpstreamRateLimitError(Object.assign(new Error('photo fetch 500'), { status: 500 })), false);
  assert.equal(isUpstreamRateLimitError(undefined), false);
});

test('an upstream 429 is expected degradation, in the fetch 429 shape the proxy throws', () => {
  const err = Object.assign(new Error('photo fetch 429'), { status: 429 });
  assert.equal(isExpectedPhotoDegradation(err), true);
});

test('isValidPhotoId accepts numeric PKs and MLS ListingIds', () => {
  assert.equal(isValidPhotoId('4777'), true);
  assert.equal(isValidPhotoId('IRE0000000000000000000000'), true);
  assert.equal(isValidPhotoId('a/b'), false);
  assert.equal(isValidPhotoId(''), false);
  assert.equal(isValidPhotoId(undefined), false);
});

test('bare photo URL redirects to the first photo index instead of the catch-all 404', () => {
  let code;
  let location;
  const res = {
    redirect: (c, l) => { code = c; location = l; },
    status: () => ({ json: () => {} }),
  };
  getListingPhotoDefault({ params: { listingId: 'IRE0000000000000000000000' } }, res);
  assert.equal(code, 302);
  assert.equal(location, '/api/photo/IRE0000000000000000000000/0');
});

test('bare photo URL with an invalid id returns 400, never a redirect', () => {
  let status;
  const res = {
    redirect: () => { throw new Error('must not redirect'); },
    status: (c) => { status = c; return { json: () => {} }; },
  };
  getListingPhotoDefault({ params: { listingId: '../secret' } }, res);
  assert.equal(status, 400);
});
