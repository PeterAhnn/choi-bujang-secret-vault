import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOperationsHandler } from '../src/operations-api.mjs';
import defaultHandler from '../api/operations.js';
import { RULE_IDS } from '../src/decider.mjs';
import manifest from '../policy/safe-policy-manifest.json' with { type: 'json' };

const actorA = '11111111-1111-4111-8111-111111111111';
const actorB = '22222222-2222-4222-8222-222222222222';
const deviceId = '1234567890abcdef';
const checkedAt = '2026-10-13T04:00:00.000Z';
const env = { SUPABASE_URL: 'https://syntheticproject.supabase.co',
  SUPABASE_SECRET_KEY: ['sb', 'secret', 'fixture'].join('_') };
const sensitive = ['synthetic memo source body', 'synthetic-person@example.invalid', actorA, actorB,
  'synthetic upstream detail', env.SUPABASE_SECRET_KEY, 'A'.repeat(43), 'B'.repeat(43)];
const tableCounts = new Map([
  ['/rest/v1/defense_note_backups', { select: 'note_id', filter: 'owner_id', total: 17 }],
  ['/rest/v1/defense_note_recovery_audit', { select: 'id', filter: 'owner_id', total: 29 }],
  ['/rest/v1/defense_devices', { select: 'device_id', filter: 'requested_by', total: 41 }],
]);

function database({ actor = actorA, status = 'approved', rows, rangeFor, totals } = {}) {
  const calls = [];
  const row = { device_id: deviceId, fingerprint: `${deviceId}${'a'.repeat(48)}`,
    public_jwk: { crv: 'P-256', kty: 'EC', x: 'A'.repeat(43), y: 'B'.repeat(43) },
    status, requested_by: actor, email: sensitive[1], content: sensitive[0] };
  return { calls, fetchImpl: async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, env.SUPABASE_URL);
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    if (options.method === 'GET') {
      assert.equal(url.pathname, '/rest/v1/defense_devices');
      assert.deepEqual([...url.searchParams.keys()].sort(), ['device_id', 'limit', 'select']);
      assert.equal(url.searchParams.get('device_id'), `eq.${deviceId}`);
      assert.equal(url.searchParams.get('select'), 'device_id,fingerprint,public_jwk,status');
      assert.equal(url.searchParams.get('limit'), '2');
      return Response.json(rows ?? [row]);
    }
    assert.equal(options.method, 'HEAD');
    const contract = tableCounts.get(url.pathname);
    assert.ok(contract, 'only documented aggregate tables may be queried');
    assert.deepEqual([...url.searchParams.keys()].sort(), [contract.filter, 'select'].sort());
    assert.equal(url.searchParams.get(contract.filter), `eq.${actor}`);
    assert.equal(url.searchParams.get('select'), contract.select);
    assert.match(options.headers.Prefer, /(?:^|,)\s*count=exact\s*(?:,|$)/u);
    assert.equal(options.body, undefined);
    const total = totals?.[url.pathname] ?? contract.total;
    const range = rangeFor ? rangeFor(url.pathname) : total === 0 ? '*/0' : `0-${total - 1}/${total}`;
    return new Response(null, { status: 200, headers: range === null ? {} : { 'Content-Range': range } });
  } };
}

function handler(db, overrides = {}) {
  const logs = [];
  return { logs, handle: createOperationsHandler({ env, fetchImpl: db.fetchImpl,
    verifyAuthorization: async authorization => ({ userId: authorization === 'synthetic-b' ? actorB : actorA }),
    logger: summary => logs.push(summary), now: () => Date.parse(checkedAt), ...overrides }) };
}

async function invoke(handle, { authorization = 'synthetic-a', method = 'GET', url = '/api/operations',
  headers = {}, body } = {}) {
  const result = { headers: {} };
  await handle({ method, url, body, headers: { ...(authorization === null ? {} : { authorization }),
    'x-device-id': deviceId, ...headers } }, {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  });
  return result;
}

function assertPrivate(value) {
  const text = JSON.stringify(value);
  for (const marker of sensitive) assert.equal(text.includes(marker), false);
  function inspect(node) {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      assert.equal(['public_jwk', 'requested_by', 'owner_id', 'email', 'content'].includes(key), false);
      inspect(child);
    }
  }
  inspect(value);
}

function assertRejected(result, status, logs) {
  assert.equal(result.status, status);
  assert.deepEqual(Object.keys(result.body), ['error']);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
  assertPrivate(result.body);
  assert.equal(logs.length, 0);
}

test('verified-user HEAD aggregates, actual rules and device status produce the exact logged safe summary', async () => {
  for (const [actor, authorization] of [[actorA, 'synthetic-a'], [actorB, 'synthetic-b']]) {
    const db = database({ actor });
    const { handle, logs } = handler(db);
    const result = await invoke(handle, { authorization,
      body: { owner_id: actor === actorA ? actorB : actorA, role: 'admin' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.schema, 'aleph.operations.v1');
    assert.match(result.body.requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    assert.equal(result.body.checkedAt, checkedAt);
    assert.equal(result.body.engine, 'ALEPH SDP 엔진 사용');
    assert.equal(result.headers['X-Request-Id'], result.body.requestId);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
    assert.ok(Array.isArray(result.body.sections) && result.body.sections.length > 0);
    const cells = [];
    for (const section of result.body.sections) {
      assert.equal(typeof section.title, 'string');
      assert.ok(section.title.length > 0);
      assert.deepEqual(section.columns, section.title === '1~11단계 요청 확인 표'
        ? ['시험', '기대 결과', '실제 API 결과', '확인 상태', '요청 ID', '확인 시각']
        : ['항목', '결과', '검증 범위']);
      assert.ok(Array.isArray(section.rows) && section.rows.length > 0);
      for (const row of section.rows) {
        assert.equal(row.length, section.columns.length);
        assert.ok(row.every(cell => typeof cell === 'string' && cell.length > 0));
        cells.push(...row);
      }
    }
    const summary = cells.join('\n');
    const resultCells = result.body.sections.flatMap(section => section.rows.map(row => row[1]));
    for (const id of RULE_IDS) assert.ok(summary.includes(id));
    assert.ok(resultCells.includes(String(RULE_IDS.length)));
    assert.ok(resultCells.includes(String(manifest.files.length)));
    assert.ok(summary.includes(manifest.safeCommit.slice(0, 12)));
    for (const { total } of tableCounts.values()) assert.match(summary, new RegExp(`\\b${total}\\b`, 'u'));
    assert.match(summary, /approved/u);
    assert.match(summary, /미연결/u);
    assert.match(summary, /미실행/u);
    assert.equal(logs.length, 1);
    assert.equal(logs[0], result.body);
    assert.deepEqual(logs[0], result.body);
    assertPrivate(result.body);
    assertPrivate(logs);
    assert.equal(db.calls.length, 4);
    assert.equal(db.calls[0].options.method, 'GET');
    assert.deepEqual(db.calls.slice(1).map(call => call.url.pathname).sort(), [...tableCounts.keys()].sort());
  }
});

test('missing, rejected and malformed verified identities return 401 before DB access', async () => {
  const verifiers = [async () => null, async () => ({ userId: 'forged-source' }),
    async () => ({ userId: [actorA] }), async () => { throw new Error(sensitive[4]); }];
  for (const verifyAuthorization of verifiers) {
    for (const authorization of [null, 'synthetic-a']) {
      const db = database();
      const { handle, logs } = handler(db, { verifyAuthorization });
      assertRejected(await invoke(handle, { authorization }), 401, logs);
      assert.equal(db.calls.length, 0);
    }
  }
});

test('other paths, queries, fragments and methods are refused without DB reads', async () => {
  const changes = [{ url: '/api/notes' }, { url: '/api/operations/extra' },
    { url: '/api/operations?owner_id=all' }, { url: '/api/operations#extra' },
    { method: 'POST' }, { method: 'HEAD' }, { method: 'DELETE' }];
  for (const change of changes) {
    const db = database();
    const { handle, logs } = handler(db);
    assertRejected(await invoke(handle, change), change.method ? 405 : 403, logs);
    assert.equal(db.calls.length, 0);
  }
});

test('missing or invalid server configuration returns 503 without DB access or success logs', async () => {
  for (const settings of [{}, { SUPABASE_URL: env.SUPABASE_URL },
    { ...env, SUPABASE_URL: `${env.SUPABASE_URL}/?extra=1` }]) {
    const db = database();
    const { handle, logs } = handler(db, { env: settings });
    assertRejected(await invoke(handle), 503, logs);
    assert.equal(db.calls.length, 0);
  }
});

test('count headers require one exact safe-integer total and valid range bounds', async () => {
  for (const range of [null, 'malformed', '0-1/2,0-2/3', '0-1/*', '0-1/2.5',
    '*/-1', '*/9007199254740992', '2-1/3', '0-3/3', '0-0/0']) {
    const db = database({ rangeFor: () => range });
    const { handle, logs } = handler(db);
    const result = await invoke(handle);
    assertRejected(result, 502, logs);
    assert.equal(result.body.error, 'OPERATIONS_UNAVAILABLE');
  }
  const emptyDb = database({ totals: Object.fromEntries([...tableCounts.keys()].map(path => [path, 0])) });
  const empty = handler(emptyDb);
  assert.equal((await invoke(empty.handle)).status, 200);
  assert.equal(empty.logs.length, 1);
});

test('upstream failures and incomplete aggregate reads return only generic 502 without success logging', async () => {
  const failures = [
    async () => { throw new Error(sensitive[4]); },
    async () => Response.json({ message: env.SUPABASE_SECRET_KEY, content: sensitive[0] }, { status: 500 }),
    async () => new Response('synthetic upstream detail', { status: 200 }),
    async () => Response.json({ detail: sensitive[4] }),
  ];
  for (const fetchImpl of failures) {
    const { handle, logs } = handler(database(), { fetchImpl });
    const result = await invoke(handle);
    assertRejected(result, 502, logs);
    assert.equal(result.body.error, 'OPERATIONS_UNAVAILABLE');
  }
  const db = database();
  const { handle, logs } = handler(db, { fetchImpl: async (url, options) => {
    if (new URL(url).pathname === '/rest/v1/defense_note_recovery_audit') {
      return new Response(null, { status: 500 });
    }
    return db.fetchImpl(url, options);
  } });
  assertRejected(await invoke(handle), 502, logs);
  assert.ok(db.calls.some(call => call.options.method === 'HEAD'));
});

test('only the current approved device can reach aggregate reads', async () => {
  for (const value of [undefined, ['1234567890abcdef'], 'ABCDEF1234567890', 'a'.repeat(15)]) {
    const db = database();
    const { handle, logs } = handler(db);
    const result = await invoke(handle, { headers: { 'x-device-id': value } });
    assertRejected(result, 403, logs);
    assert.equal(result.body.error, 'DEVICE_NOT_APPROVED');
    assert.equal(db.calls.length, 0);
  }
  for (const status of ['pending', 'denied', 'revoked', null]) {
    const db = database(status ? { status } : { rows: [] });
    const { handle, logs } = handler(db);
    const result = await invoke(handle);
    assertRejected(result, 403, logs);
    assert.equal(result.body.error, 'DEVICE_NOT_APPROVED');
    assert.equal(db.calls.length, 1);
    assert.equal(db.calls[0].options.method, 'GET');
  }
});

test('the actual default operations entry point refuses unauthenticated requests', async () => {
  const result = await invoke(defaultHandler, { authorization: null });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'LOGIN_REQUIRED' });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
});
