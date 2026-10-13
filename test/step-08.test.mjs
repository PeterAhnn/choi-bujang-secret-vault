import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDecider, decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const policy = () => ({ classId: 'synthetic_class', projectId: 'synthetic_project',
  policyRevision: 4, service: 'notes', path: '/api/notes/opaque-note', routePath: '/api/notes/:id',
  grants: [{ subjectId: 'synthetic_owner', deviceId: '1'.repeat(16), methods: ['GET', 'PUT'] }] });
const request = () => ({ ...fixtureRequests().normal, requestId: randomUUID(),
  classId: 'synthetic_class', projectId: 'synthetic_project', policyRevision: 4,
  subjectId: 'synthetic_owner', deviceId: '1'.repeat(16),
  service: 'notes', path: '/api/notes/opaque-note', route: 'GET /api/notes/:id' });

test('unregistered item is denied even if caller and path look valid', async () => {
  assert.equal((await decide(request())).decision, 'deny');
  assert.equal((await decide({ ...request(), subjectId: 'synthetic_other' })).decision, 'deny');
});

test('trusted exact resource grant allows owner read and update, rejects other user', async () => {
  const scoped = createDecider([policy()]);
  assert.equal((await scoped(request())).decision, 'allow');
  assert.equal((await scoped({ ...request(), method: 'PUT', route: 'PUT /api/notes/:id' })).decision, 'allow');
  assert.equal((await scoped({ ...request(), subjectId: 'synthetic_other' })).decision, 'deny');
});

test('resource policy rejects mismatched scope, device, action, route and query', async () => {
  const scoped = createDecider([policy()]);
  for (const change of [
    { classId: 'other_class' }, { projectId: 'other_project' }, { policyRevision: 5 },
    { deviceId: '2'.repeat(16) }, { path: '/api/notes/other-note' },
    { method: 'DELETE', route: 'DELETE /api/notes/:id' },
    { route: 'GET /api/notes/opaque-note' }, { queryLength: 12 },
    { path: '/api/notes/export' }, { role: 'teacher', subjectId: 'synthetic_other' },
  ]) assert.equal((await scoped({ ...request(), ...change })).decision, 'deny');
});

test('announcement update is available only to server-granted subject and device', async () => {
  const announcement = { ...policy(), service: 'announcements', path: '/api/announcements/notice',
    routePath: '/api/announcements/:id', grants: [{ subjectId: 'synthetic_teacher',
      deviceId: '3'.repeat(16), methods: ['PUT'] }] };
  const scoped = createDecider([announcement]);
  const input = { ...request(), service: 'announcements', path: announcement.path,
    method: 'PUT', route: 'PUT /api/announcements/:id' };
  assert.equal((await scoped(input)).decision, 'deny');
  assert.equal((await scoped({ ...input, subjectId: 'synthetic_teacher', deviceId: '3'.repeat(16) })).decision, 'allow');
});

test('policy snapshot cannot be expanded through mutation or a request field', async () => {
  const trusted = policy();
  const scoped = createDecider([trusted]);
  trusted.grants[0].subjectId = 'synthetic_other';
  trusted.grants[0].methods.push('DELETE');
  assert.equal((await scoped(request())).decision, 'allow');
  assert.equal((await scoped({ ...request(), subjectId: 'synthetic_other', resourcePolicies: [trusted] })).decision, 'deny');
  assert.equal((await scoped({ ...request(), method: 'DELETE', route: 'DELETE /api/notes/:id' })).decision, 'deny');
});

test('existing device and step-up conditions remain active for granted items', async () => {
  const scoped = createDecider([policy()]);
  assert.equal((await scoped({ ...request(), deviceRegistered: false })).reasonCode, 'device_not_registered');
  const suspicious = { ...request(), signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
    recentEvents: [{ kind: 'risk_signal', ageSeconds: 60, count: 20 }] };
  assert.equal((await scoped(suspicious)).decision, 'step_up');
  assert.equal((await scoped({ ...suspicious, stepUp: { verified: true, authAgeSeconds: 60 } })).decision, 'allow');
});
