import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotesHandler } from '../api/notes.js';

async function request(handler, headers = {}) {
  const result = { headers: {} };
  await handler({ method: 'GET', headers }, {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; },
  });
  return result;
}

test('missing, rejected and failed authentication never reads the DB or returns notes', async () => {
  for (const verifier of [async () => null, async () => { throw new Error('synthetic provider detail'); }]) {
    const handler = createNotesHandler({ verifyAuthorization: verifier,
      fetchImpl() { assert.fail('DB must not be queried'); } });
    for (const headers of [{}, { authorization: 'untrusted fixture', userId: 'forged-user', role: 'admin' }]) {
      const result = await request(handler, headers);
      assert.equal(result.status, 401);
      assert.deepEqual(Object.keys(result.body), ['error']);
      assert.equal(result.headers['Cache-Control'], 'no-store');
      assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
    }
  }
});

test('the unmodified login verifier rejects malformed authorization without DB access', async () => {
  const handler = createNotesHandler({ env: { SUPABASE_SECRET_KEY: ['sb', 'secret', 'fixture'].join('_') },
    fetchImpl() { assert.fail('DB must not be queried'); } });
  const result = await request(handler, { authorization: 'Bearer invalid' });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'INVALID_LOGIN' });
});
