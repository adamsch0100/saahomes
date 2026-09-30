import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpiredMlsUrl,
  expiredUrlError,
  isExpectedPhotoDegradation,
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
