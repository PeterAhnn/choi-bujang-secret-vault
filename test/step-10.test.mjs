import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRestoreHandler } from '../src/restore-api.mjs';

const owner = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const env = { SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SECRET_KEY: ['sb','secret','fixture'].join('_') };
async function call(handler, { authorization = 'synthetic-b', method = 'POST', url = '/api/restore', body = { id } } = {}) {
  const result = { headers: {} };
  await handler({ method, url, headers: authorization === null ? {} : { authorization }, body }, {
    setHeader(name, value) { result.headers[name] = value; },
    status(value) { result.status = value; return this; }, json(value) { result.body = value; },
  });
  return result;
}

test('restore authenticates before RPC and never trusts request owner, role or action', async () => {
  const rejected = createRestoreHandler({ verifyAuthorization: async () => { throw new Error('ignored detail'); },
    fetchImpl() { assert.fail('RPC must not be called'); } });
  assert.deepEqual((await call(rejected, { authorization: null })).body, { error: 'LOGIN_REQUIRED' });
  assert.deepEqual((await call(rejected)).body, { error: 'INVALID_LOGIN' });
  const handler = createRestoreHandler({ env, verifyAuthorization: async () => ({ userId: owner }),
    fetchImpl() { assert.fail('RPC must not be called'); } });
  for (const change of [{ body: { id, owner_id: owner } }, { body: { id, role: 'admin' } },
    { body: { id: '../other' } }, { body: { id: [id] } }, { body: { id: 123 } },
    { url: '/api/restore?action=all' }, { url: '/api/restore/extra' }, { method: 'DELETE' }]) {
    assert.ok([400, 403, 405].includes((await call(handler, change)).status));
  }
});

test('a verified B target is sent with the verified owner and response fields are restricted', async () => {
  let payload;
  const handler = createRestoreHandler({ env, verifyAuthorization: async () => ({ userId: owner }),
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/rest/v1/rpc/defense_restore_note');
      payload = JSON.parse(options.body);
      return Response.json({ id, restored: true, contentHash: 'a'.repeat(64), internal: 'ignored' });
    } });
  const result = await call(handler);
  assert.equal(result.status, 200);
  assert.deepEqual(payload, { p_note_id: id, p_owner_id: owner });
  assert.deepEqual(Object.keys(result.body).sort(), ['contentHash', 'id', 'restored']);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(result.body).includes(env.SUPABASE_SECRET_KEY));
});

test('foreign, corrupt and unexpected restore results expose only short denial reasons', async () => {
  for (const [data, status, expected] of [
    [{ message: 'backup_not_found', details: 'ignored' }, 400, 404],
    [{ message: 'restore_denied', details: 'ignored' }, 400, 403],
    [{ message: 'backup_invalid', details: 'ignored' }, 400, 409],
    [{ code: '23505', details: 'ignored' }, 409, 409],
    [{ id, restored: true, contentHash: 'invalid' }, 200, 502],
  ]) {
    const handler = createRestoreHandler({ env, verifyAuthorization: async () => ({ userId: owner }),
      fetchImpl: async () => Response.json(data, { status }) });
    const result = await call(handler);
    assert.equal(result.status, expected);
    assert.deepEqual(Object.keys(result.body), ['error']);
    assert.ok(!JSON.stringify(result.body).includes('ignored'));
  }
});
