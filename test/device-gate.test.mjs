import assert from 'node:assert/strict';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { test } from 'node:test';
import { SignJWT, jwtVerify } from 'jose';
import { createDeviceGate } from '../src/device-gate.mjs';
import { createDeviceHandler } from '../src/device-api.mjs';
import { canonicalBody, canonicalProtectedPath, canonicalRequest, publicJwkCanonical } from '../public/device-protocol.js';

const fixedTime = Date.UTC(2026, 9, 13, 0, 0, 0);
const epochSeconds = Math.floor(fixedTime / 1000);
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const noteId = '33333333-3333-4333-8333-333333333333';
const otherNoteId = '44444444-4444-4444-8444-444444444444';
const env = { SUPABASE_URL: 'https://syntheticproject.supabase.co',
  SUPABASE_SECRET_KEY: ['sb', 'secret', 'fixture'].join('_') };
const hash = value => createHash('sha256').update(value).digest('hex');
const jwtKey = randomBytes(32);

async function makeJwt(userId) {
  return `Bearer ${await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
    .setIssuer('https://synthetic-login.invalid').setAudience('device-test')
    .setIssuedAt(epochSeconds).setExpirationTime(epochSeconds + 300).sign(jwtKey)}`;
}

async function verifyAuthorization(authorization) {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) throw new Error('invalid fixture authorization');
  const { payload } = await jwtVerify(authorization.slice(7), jwtKey, {
    issuer: 'https://synthetic-login.invalid', audience: 'device-test', currentDate: new Date(fixedTime),
  });
  return { userId: payload.sub };
}

async function makeDevice() {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const exported = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const publicKey = { crv: exported.crv, kty: exported.kty, x: exported.x, y: exported.y };
  const fingerprint = hash(publicJwkCanonical(publicKey));
  return { publicKey, privateKey: pair.privateKey, fingerprint, deviceId: fingerprint.slice(0, 16) };
}

const fixtures = Promise.all([makeDevice(), makeDevice(), makeJwt(userA), makeJwt(userB)])
  .then(([deviceA, deviceB, authorizationA, authorizationB]) => ({ deviceA, deviceB, authorizationA, authorizationB }));

function deviceRow(device, status = 'approved', requestedBy = userA) {
  return { device_id: device.deviceId, fingerprint: device.fingerprint, public_jwk: device.publicKey,
    status, requested_by: requestedBy, provider_detail: 'synthetic internal detail' };
}

function database(initialRows = []) {
  const rows = new Map(initialRows.map(row => [row.device_id, structuredClone(row)]));
  const claimed = new Set();
  const calls = [];
  return { rows, calls, claimed, fetchImpl: async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, env.SUPABASE_URL);
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    if (url.pathname === '/rest/v1/rpc/defense_claim_device_nonce') {
      assert.equal(options.method, 'POST');
      assert.equal(url.search, '');
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ['p_device_id', 'p_nonce', 'p_user_id']);
      assert.match(body.p_device_id, /^[a-f0-9]{16}$/u);
      assert.match(body.p_nonce, /^[A-Za-z0-9_-]{32}$/u);
      assert.ok([userA, userB].includes(body.p_user_id));
      const claim = `${body.p_device_id}:${body.p_nonce}`;
      if (claimed.has(claim)) return Response.json(false);
      claimed.add(claim);
      return Response.json(true);
    }
    assert.equal(url.pathname, '/rest/v1/defense_devices');
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ['device_id', 'fingerprint', 'public_jwk', 'requested_by']);
      assert.equal(body.device_id, body.fingerprint.slice(0, 16));
      assert.equal(body.fingerprint, hash(publicJwkCanonical(body.public_jwk)));
      assert.ok([userA, userB].includes(body.requested_by));
      assert.match(options.headers.Prefer, /resolution=ignore-duplicates/u);
      assert.match(options.headers.Prefer, /return=minimal/u);
      if (!rows.has(body.device_id)) rows.set(body.device_id, { ...structuredClone(body), status: 'pending' });
      return new Response(null, { status: 201 });
    }
    assert.equal(options.method, 'GET');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['device_id', 'limit', 'select']);
    assert.equal(url.searchParams.get('select'), 'device_id,fingerprint,public_jwk,status');
    assert.equal(url.searchParams.get('limit'), '2');
    const filter = url.searchParams.get('device_id');
    assert.match(filter, /^eq\.[a-f0-9]{16}$/u);
    const row = rows.get(filter.slice(3));
    return Response.json(row ? [row] : []);
  } };
}

async function signRequest({ device, userId = userA, authorization, method = 'GET',
  url = '/api/notes', body, timestamp = epochSeconds, nonce = randomBytes(24).toString('base64url') }) {
  const path = canonicalProtectedPath(url);
  const message = canonicalRequest({ userId, deviceId: device.deviceId, method, path,
    timestamp: String(timestamp), nonce, bodyHash: hash(canonicalBody(body)) });
  const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, device.privateKey,
    new TextEncoder().encode(message));
  assert.equal(signature.byteLength, 64);
  const encodedSignature = Buffer.from(signature).toString('base64url');
  assert.equal(encodedSignature.length, 86);
  return { method, url, body, headers: { authorization, 'x-device-id': device.deviceId,
    'x-device-time': String(timestamp), 'x-device-nonce': nonce, 'x-device-signature': encodedSignature } };
}

async function invoke(handler, request) {
  const result = { headers: {} };
  await handler(request, {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  });
  return result;
}

function gate(db, overrides = {}) {
  let nextCalls = 0;
  const handler = createDeviceGate((_request, response) => {
    nextCalls += 1;
    return response.status(200).json({ accepted: true });
  }, { env, fetchImpl: db.fetchImpl, verifyAuthorization, now: () => fixedTime, ...overrides });
  return { handler, get nextCalls() { return nextCalls; } };
}

function assertDenied(result, status, error) {
  assert.equal(result.status, status);
  assert.deepEqual(Object.keys(result.body), ['error']);
  if (error) assert.equal(result.body.error, error);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify(result.body).includes(env.SUPABASE_SECRET_KEY));
  assert.ok(!JSON.stringify(result.body).includes('synthetic internal detail'));
}

function api(db, route, overrides = {}) {
  return createDeviceHandler({ route, env, fetchImpl: db.fetchImpl, verifyAuthorization, ...overrides });
}

function apiRequest(route, authorization, body, deviceId) {
  return { method: route === 'request' ? 'POST' : 'GET',
    url: `/api/device/${route}${deviceId ? `?id=${deviceId}` : ''}`,
    headers: authorization ? { authorization } : {}, body };
}

test('approved devices A and B require both a verified JWT and a real P-256 signature', async () => {
  const { deviceA, deviceB, authorizationA, authorizationB } = await fixtures;
  const db = database([deviceRow(deviceA), deviceRow(deviceB, 'approved', userB)]);
  const guarded = gate(db);
  for (const [device, userId, authorization] of [[deviceA, userA, authorizationA], [deviceB, userB, authorizationB]]) {
    const request = await signRequest({ device, userId, authorization, method: 'POST',
      body: { title: 'Synthetic title', body: 'Synthetic text' } });
    assert.equal((await invoke(guarded.handler, request)).status, 200);
    const claim = JSON.parse(db.calls.at(-1).options.body);
    assert.equal(claim.p_user_id, userId);
    assert.equal(claim.p_device_id, device.deviceId);
  }
  assert.equal(guarded.nextCalls, 2);
});

test('missing and invalid authentication never call the DB or protected handler', async () => {
  const { deviceA, authorizationA } = await fixtures;
  for (const authorization of [undefined, 'Bearer invalid', authorizationA.replace(/.$/u, '!')]) {
    const db = database([deviceRow(deviceA)]);
    const guarded = gate(db);
    const request = await signRequest({ device: deviceA, authorization });
    assertDenied(await invoke(guarded.handler, request), 401);
    assert.equal(db.calls.length, 0);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('a valid login without the signature headers is denied before DB access', async () => {
  const { authorizationA } = await fixtures;
  const db = database();
  const guarded = gate(db);
  assertDenied(await invoke(guarded.handler, { method: 'GET', url: '/api/notes',
    headers: { authorization: authorizationA } }), 403, 'UNSIGNED_CLIENT_REQUEST');
  assert.equal(db.calls.length, 0);
  assert.equal(guarded.nextCalls, 0);
});

test('unknown, pending, denied and revoked devices never reach the protected handler', async () => {
  const { deviceA, authorizationA } = await fixtures;
  for (const status of [null, 'pending', 'denied', 'revoked']) {
    const db = database(status ? [deviceRow(deviceA, status)] : []);
    const guarded = gate(db);
    const request = await signRequest({ device: deviceA, authorization: authorizationA });
    assertDenied(await invoke(guarded.handler, request), 403, 'DEVICE_NOT_APPROVED');
    assert.equal(db.calls.length, 1);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('signatures bind the path, body, method, login subject and device key', async () => {
  const { deviceA, deviceB, authorizationA, authorizationB } = await fixtures;
  const original = await signRequest({ device: deviceA, authorization: authorizationA, method: 'PUT',
    url: `/api/notes/${noteId}`, body: { title: 'Synthetic title', body: 'Original synthetic text' } });
  const wrongKey = await signRequest({ device: deviceB, authorization: authorizationA, method: 'PUT',
    url: original.url, body: original.body });
  const changes = [
    { url: `/api/notes/${otherNoteId}` },
    { body: { ...original.body, body: 'Changed synthetic text' } },
    { method: 'DELETE' },
    { headers: { ...original.headers, authorization: authorizationB } },
    { headers: { ...original.headers, 'x-device-signature': wrongKey.headers['x-device-signature'] } },
  ];
  for (const change of changes) {
    const db = database([deviceRow(deviceA)]);
    const guarded = gate(db);
    assertDenied(await invoke(guarded.handler, { ...original, ...change }), 403, 'SIGNED_REQUEST_INVALID');
    assert.equal(db.claimed.size, 0);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('a valid signed request can be used only once, including across login subjects', async () => {
  const { deviceA, authorizationA, authorizationB } = await fixtures;
  const db = database([deviceRow(deviceA)]);
  const guarded = gate(db);
  const requestA = await signRequest({ device: deviceA, authorization: authorizationA });
  assert.equal((await invoke(guarded.handler, requestA)).status, 200);
  assertDenied(await invoke(guarded.handler, requestA), 403, 'SIGNED_REQUEST_REPLAYED');
  const requestB = await signRequest({ device: deviceA, userId: userB, authorization: authorizationB,
    nonce: requestA.headers['x-device-nonce'] });
  assertDenied(await invoke(guarded.handler, requestB), 403, 'SIGNED_REQUEST_REPLAYED');
  assert.equal(guarded.nextCalls, 1);
});

test('only an exact single Vercel id query normalizes to the signed note path', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const path = `/api/notes/${noteId}`;
  const db = database([deviceRow(deviceA)]);
  const guarded = gate(db);
  const signed = await signRequest({ device: deviceA, authorization: authorizationA, url: path });
  assert.equal((await invoke(guarded.handler, { ...signed, url: `${path}?id=${noteId}` })).status, 200);
  assert.equal(guarded.nextCalls, 1);
  for (const url of [`${path}?id=${otherNoteId}`, `${path}?id=${noteId}&id=${noteId}`,
    `${path}?id=${noteId}&action=export`, '/api/notes?owner_id=all', `${path}#extra`]) {
    const rejectedDb = database([deviceRow(deviceA)]);
    const rejected = gate(rejectedDb);
    assertDenied(await invoke(rejected.handler, { ...signed, url }), 403, 'SIGNED_REQUEST_INVALID');
    assert.equal(rejectedDb.claimed.size, 0);
    assert.equal(rejected.nextCalls, 0);
  }
});

test('timestamp tolerance includes both 60-second boundaries and rejects 61 seconds', async () => {
  const { deviceA, authorizationA } = await fixtures;
  for (const seconds of [-61, -60, 60, 61]) {
    const db = database([deviceRow(deviceA)]);
    const guarded = gate(db);
    const request = await signRequest({ device: deviceA, authorization: authorizationA,
      timestamp: epochSeconds + seconds });
    const result = await invoke(guarded.handler, request);
    if (Math.abs(seconds) === 60) {
      assert.equal(result.status, 200);
      assert.equal(guarded.nextCalls, 1);
    } else {
      assertDenied(result, 403, 'SIGNED_REQUEST_INVALID');
      assert.equal(db.calls.length, 0);
      assert.equal(guarded.nextCalls, 0);
    }
  }
});

test('malformed signature fields are rejected without DB access', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const original = await signRequest({ device: deviceA, authorization: authorizationA });
  for (const [name, value, error = 'SIGNED_REQUEST_INVALID'] of [['x-device-id', 'a'.repeat(15)],
    ['x-device-time', `${epochSeconds}.5`], ['x-device-nonce', 'a'.repeat(31)],
    ['x-device-signature', 'a'.repeat(85)], ['x-device-signature', ['a'.repeat(86)], 'UNSIGNED_CLIENT_REQUEST']]) {
    const db = database([deviceRow(deviceA)]);
    const guarded = gate(db);
    assertDenied(await invoke(guarded.handler, { ...original,
      headers: { ...original.headers, [name]: value } }), 403, error);
    assert.equal(db.calls.length, 0);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('missing server configuration returns 503 and never reaches the DB or handler', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const signed = await signRequest({ device: deviceA, authorization: authorizationA });
  for (const settings of [{}, { SUPABASE_URL: env.SUPABASE_URL },
    { ...env, SUPABASE_URL: `${env.SUPABASE_URL}/?unexpected=1` }]) {
    const db = database([deviceRow(deviceA)]);
    const guarded = gate(db, { env: settings });
    assertDenied(await invoke(guarded.handler, signed), 503);
    assert.equal(db.calls.length, 0);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('DB failures and malformed nonce claims produce generic 502 without calling next', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const request = await signRequest({ device: deviceA, authorization: authorizationA });
  const failures = [
    async () => { throw new Error(env.SUPABASE_SECRET_KEY); },
    async () => Response.json({ message: env.SUPABASE_SECRET_KEY }, { status: 500 }),
    async () => new Response('synthetic internal detail', { status: 200 }),
    async () => Response.json({ unexpected: 'synthetic internal detail' }),
    async input => new URL(input).pathname.endsWith('/defense_devices')
      ? Response.json([deviceRow(deviceA)]) : Response.json({ accepted: true, detail: env.SUPABASE_SECRET_KEY }),
  ];
  for (const fetchImpl of failures) {
    const guarded = gate(database(), { fetchImpl });
    assertDenied(await invoke(guarded.handler, request), 502);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('a device row with an inconsistent fingerprint or public key fails closed', async () => {
  const { deviceA, deviceB, authorizationA } = await fixtures;
  const request = await signRequest({ device: deviceA, authorization: authorizationA });
  for (const [change, status, error] of [
    [{ fingerprint: 'b'.repeat(64) }, 403, 'SIGNED_REQUEST_INVALID'],
    [{ public_jwk: deviceB.publicKey }, 403, 'SIGNED_REQUEST_INVALID'],
    [{ public_jwk: { ...deviceA.publicKey, x: 'A'.repeat(43), y: 'A'.repeat(43) } }, 502, 'DEVICE_UNAVAILABLE']]) {
    const db = database([{ ...deviceRow(deviceA), ...change }]);
    const guarded = gate(db);
    assertDenied(await invoke(guarded.handler, request), status, error);
    assert.equal(db.claimed.size, 0);
    assert.equal(guarded.nextCalls, 0);
  }
});

test('registration imports the real public key and inserts only four allowed columns', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const db = database();
  const result = await invoke(api(db, 'request'), apiRequest('request', authorizationA, { publicKey: deviceA.publicKey }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { deviceId: deviceA.deviceId, fingerprint: deviceA.fingerprint, status: 'pending' });
  assert.deepEqual(db.calls.map(call => call.options.method), ['POST', 'GET']);
  assert.equal(db.rows.get(deviceA.deviceId).requested_by, userA);
  assert.equal(db.rows.get(deviceA.deviceId).status, 'pending');
});

test('duplicate registration preserves an approved row and its original requester', async () => {
  const { deviceA, authorizationB } = await fixtures;
  const original = deviceRow(deviceA, 'approved', userA);
  const db = database([original]);
  const result = await invoke(api(db, 'request'), apiRequest('request', authorizationB, { publicKey: deviceA.publicKey }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { deviceId: deviceA.deviceId, fingerprint: deviceA.fingerprint, status: 'approved' });
  assert.deepEqual(db.rows.get(deviceA.deviceId), original);
  assert.deepEqual(db.calls.map(call => call.options.method), ['POST', 'GET']);
});

test('registration cannot inject status, role, owner or private-key fields', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const inputs = [null, [], { publicKey: deviceA.publicKey, status: 'approved' },
    { publicKey: deviceA.publicKey, role: 'admin' }, { publicKey: deviceA.publicKey, owner: userB },
    { publicKey: deviceA.publicKey, owner_id: userB },
    { publicKey: { ...deviceA.publicKey, d: 'A'.repeat(43) } },
    { publicKey: { ...deviceA.publicKey, key_ops: ['sign'] } },
    { publicKey: { ...deviceA.publicKey, crv: 'P-384' } },
    { publicKey: { ...deviceA.publicKey, x: 'A'.repeat(43), y: 'A'.repeat(43) } }];
  for (const body of inputs) {
    const db = database();
    assertDenied(await invoke(api(db, 'request'), apiRequest('request', authorizationA, body)), 400);
    assert.equal(db.calls.length, 0);
  }
});

test('registration refuses a device-id fingerprint collision', async () => {
  const { deviceA, authorizationA } = await fixtures;
  const db = database([{ ...deviceRow(deviceA), fingerprint: `${deviceA.deviceId}${'0'.repeat(48)}` }]);
  assertDenied(await invoke(api(db, 'request'), apiRequest('request', authorizationA,
    { publicKey: deviceA.publicKey })), 409);
  assert.deepEqual(db.calls.map(call => call.options.method), ['POST', 'GET']);
});

test('status requires a verified JWT and returns only the three public status fields', async () => {
  const { deviceA, authorizationB } = await fixtures;
  const db = database([deviceRow(deviceA)]);
  const result = await invoke(api(db, 'status'), apiRequest('status', authorizationB, undefined, deviceA.deviceId));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { deviceId: deviceA.deviceId, fingerprint: deviceA.fingerprint, status: 'approved' });
  assert.deepEqual(Object.keys(result.body).sort(), ['deviceId', 'fingerprint', 'status']);
  const unknown = database();
  assertDenied(await invoke(api(unknown, 'status'), apiRequest('status', authorizationB,
    undefined, deviceA.deviceId)), 404);
});

test('both device endpoints reject missing or invalid login without querying DB', async () => {
  const { deviceA } = await fixtures;
  for (const route of ['request', 'status']) {
    for (const authorization of [undefined, 'Bearer invalid']) {
      const db = database();
      const request = apiRequest(route, authorization, { publicKey: deviceA.publicKey }, deviceA.deviceId);
      assertDenied(await invoke(api(db, route), request), 401);
      assert.equal(db.calls.length, 0);
    }
  }
});

test('both device endpoints return 503 for missing configuration and generic 502 for DB failures', async () => {
  const { deviceA, authorizationA } = await fixtures;
  for (const route of ['request', 'status']) {
    const request = apiRequest(route, authorizationA, { publicKey: deviceA.publicKey }, route === 'status' ? deviceA.deviceId : undefined);
    const unconfigured = database();
    assertDenied(await invoke(api(unconfigured, route, { env: {} }), request), 503);
    assert.equal(unconfigured.calls.length, 0);
    for (const fetchImpl of [async () => { throw new Error(env.SUPABASE_SECRET_KEY); },
      async () => Response.json({ message: env.SUPABASE_SECRET_KEY, detail: 'synthetic internal detail' }, { status: 500 })]) {
      assertDenied(await invoke(api(database(), route, { fetchImpl }), request), 502);
    }
  }
});
