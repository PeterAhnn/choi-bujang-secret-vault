import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDetectionEvents, findBurstCandidate, detect } from '../src/detect.mjs';

test('input processing retains only documented pseudonymous event fields', () => {
  const at = '2026-10-01T00:00:00.000Z';
  const events = readDetectionEvents([{ at, method: 'GET', identity: { sub: 'synthetic-a', name: 'ignored' },
    note: 'ignored', token: 'ignored', role: 'teacher', deviceId: 'unverified', network: 'unverified' }]);
  assert.deepEqual(events, [{ at: Date.parse(at), method: 'GET', subject: 'synthetic-a' }]);
  assert.throws(() => readDetectionEvents(null), /invalid_detection_events/u);
  assert.deepEqual(readDetectionEvents([null, {}, { at: 'invalid', method: 'GET', identity: { sub: 'synthetic-a' } }]), []);
});

const reads = (count, subject = 'synthetic-a', interval = 2, method = 'GET') =>
  Array.from({ length: count }, (_, index) => ({ at: new Date(1790812800000 + index * interval * 1000).toISOString(),
    method, identity: { sub: subject } }));

test('the documented burst boundary separates users and sliding time windows', () => {
  assert.equal(findBurstCandidate(reads(120)), null);
  assert.equal(findBurstCandidate(reads(121)).subject, 'synthetic-a');
  assert.equal(findBurstCandidate([...reads(100), ...reads(100, 'synthetic-b')] ), null);
  assert.equal(findBurstCandidate(reads(200, 'synthetic-a', 7)), null);
  assert.equal(findBurstCandidate(reads(200, 'synthetic-a', 1, 'POST')), null);
  assert.equal(findBurstCandidate(reads(121).reverse()).subject, 'synthetic-a');
});

test('the actual detector returns one documented proposal and does not retain revocation state', () => {
  const events = [...reads(121), ...reads(121, 'synthetic-b', 3)];
  const original = JSON.stringify(events);
  assert.deepEqual(detect(events), { action: 'propose_revocation', reasonCode: 'burst_read', subject: 'synthetic-a' });
  assert.equal(JSON.stringify(events), original);
  assert.deepEqual(detect(reads(30)), { action: 'observe' });
});
