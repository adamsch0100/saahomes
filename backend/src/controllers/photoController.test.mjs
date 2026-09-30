import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpiredMlsUrl,
  expiredUrlError,
  isExpectedPhotoDegradation,
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
