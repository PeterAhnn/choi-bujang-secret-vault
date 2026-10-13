import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

function noteRequest(change = {}) {
  return { ...fixtureRequests().normal, requestId: randomUUID(), ...change };
}

test('the real entry preserves virtual A read and update', async () => {
  const request = noteRequest();
  assert.equal((await decide(request)).decision, 'allow');
  assert.equal((await decide(noteRequest({ method: 'PUT', route: request.route.replace(/^GET /u, 'PUT ') }))).decision, 'allow');
});

test('the real entry never opens collection routes for any method', async () => {
  for (const path of ['/notes', '/api/notes']) {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await decide(noteRequest({ path, method, route: `${method} ${path}` }))).decision, 'deny');
    }
  }
});

test('all announcement and instructor writes are rejected without trusting a role', async () => {
  for (const service of ['announcements', 'instructor']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const request = noteRequest({ service, method,
        path: `/${service}/synthetic-notice`, route: `${method} /${service}/:id`, role: 'teacher' });
      assert.equal((await decide(request)).decision, 'deny');
    }
  }
});

test('unknown routes, function paths, action queries and method mismatches are rejected', async () => {
  for (const change of [
    { path: '/unknown', route: 'GET /unknown' },
    { path: '/notes/export', route: 'GET /notes/:id' },
    { path: '/notes/list', route: 'GET /notes/:id' },
    { path: '/notes/bulk', route: 'GET /notes/:id' },
    { path: '/notes/announcements', method: 'PUT', route: 'PUT /notes/:id' },
    { path: '/notes/instructor', method: 'DELETE', route: 'DELETE /notes/:id' },
    { queryLength: 12 },
    { method: 'DELETE', route: 'GET /notes/:id' },
  ]) assert.equal((await decide(noteRequest(change))).decision, 'deny');
});

test('device registration and step-up rules still apply at the real entry', async () => {
  const { normal, suspicious } = fixtureRequests();
  assert.equal((await decide({ ...normal, deviceRegistered: false })).reasonCode, 'device_not_registered');
  assert.equal((await decide(suspicious)).decision, 'step_up');
  assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: 60 } })).decision, 'allow');
});
