import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotesHandler } from '../api/notes.js';

async function request(handler, headers = {}, method = 'GET', body, url = '/api/notes') {
  const result = { headers: {} };
  await handler({ method, headers, body, url }, {
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

test('CRUD uses verified owner, lists only that owner, and preserves step 3 item-access gap', async () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const id = '33333333-3333-4333-8333-333333333333';
  const rows = new Map();
  const make = itemRoute => createNotesHandler({ itemRoute,
    env: { SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SECRET_KEY: ['sb','secret','fixture'].join('_') },
    verifyAuthorization: async authorization => ({ userId: authorization === 'a' ? a : b }),
    fetchImpl: async (url, options) => {
      if (options.method === 'POST') {
        const row = JSON.parse(options.body);
        rows.set(row.note_id, row);
        return Response.json([row]);
      }
      const targetId = url.searchParams.get('note_id')?.slice(3);
      if (targetId) {
        let row = rows.get(targetId);
        if (!row) return Response.json([]);
        if (options.method === 'PATCH') { row = { ...row, ...JSON.parse(options.body) }; rows.set(targetId, row); }
        if (options.method === 'DELETE') rows.delete(targetId);
        return Response.json([row]);
      }
      const owner = url.searchParams.get('owner_id')?.slice(3);
      return Response.json([...rows.values()].filter(row => row.owner_id === owner));
    },
  });
  const collection = make(false), item = make(true);
  const created = await request(collection, { authorization: 'a' }, 'POST',
    { id, title: 'Synthetic title', body: 'Synthetic body', owner_id: b, userId: b, role: 'admin' });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id });
  assert.equal(rows.get(id).owner_id, a);
  assert.equal((await request(collection, { authorization: 'a' })).body.length, 1);
  assert.deepEqual((await request(collection, { authorization: 'b' })).body, []);
  const otherOwnerRead = await request(item, { authorization: 'b' }, 'GET', undefined, `/api/notes/${id}`);
  assert.equal(otherOwnerRead.status, 200);
  assert.deepEqual(Object.keys(otherOwnerRead.body).sort(), ['body','id','title']);
  const updated = await request(item, { authorization: 'b' }, 'PUT',
    { title: 'Synthetic revised title', body: 'Synthetic revised body', owner_id: b }, `/api/notes/${id}`);
  assert.equal(updated.status, 200);
  assert.equal(rows.get(id).owner_id, a);
  assert.equal(updated.body.body, 'Synthetic revised body');
  const removed = await request(item, { authorization: 'a' }, 'DELETE', undefined, `/api/notes/${id}`);
  assert.equal(removed.status, 200);
  const missing = await request(item, { authorization: 'a' }, 'GET', undefined, `/api/notes/${id}`);
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'NOTE_NOT_FOUND' });
  const generated = await request(collection, { authorization: 'a' }, 'POST', { title: 'Synthetic', body: 'Synthetic' });
  assert.equal(generated.status, 201);
  assert.match(generated.body.id, /^[a-f0-9-]{36}$/u);
});
