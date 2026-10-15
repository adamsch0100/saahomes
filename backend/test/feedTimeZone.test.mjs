/** "Listing information last updated …" reads in the MLS's own time zone. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedTimeZone } from '../src/services/feeds.js';

test('the update time follows the state the MLS covers', () => {
  const at = new Date('2026-10-14T18:00:00Z');
  const fmt = (states) => { const z = feedTimeZone(states); return `${z.format.format(at)} ${z.label}`; };
  assert.equal(fmt(['CO']), 'Oct 14, 2026, 12:00 PM MT');
  assert.equal(fmt(['NC', 'SC']), 'Oct 14, 2026, 2:00 PM ET');
  assert.equal(fmt(['TX']), 'Oct 14, 2026, 1:00 PM CT');
  assert.equal(fmt(['CA']), 'Oct 14, 2026, 11:00 AM PT');
  assert.equal(fmt(['AZ']), 'Oct 14, 2026, 11:00 AM MT', 'Arizona keeps standard time');
  assert.equal(fmt([]), 'Oct 14, 2026, 12:00 PM MT', 'no states: Mountain, as before');
});
