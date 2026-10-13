import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createObservedHandler } from '../src/request-observation.mjs';
import notesHandler from '../api/notes.js';
import noteHandler from '../api/notes/[id].js';
import restoreHandler from '../api/restore.js';
import config from '../aleph.config.json' with { type: 'json' };

const fixedTime = Date.UTC(2026, 9, 13, 6, 0, 0);
const isoTime = new Date(fixedTime).toISOString();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const resources = ['notes_collection', 'note_item', 'restore'];
const expectedKeys = ['event', 'schema', 'requestId', 'checkedAt', 'resource', 'method', 'status',
  'errorCode', 'authorizationPresent', 'signaturePresent'].sort();
const privateMarker = ['synthetic', 'private', 'content'].join('-');

function request(overrides = {}) {
  return { method: 'GET', url: '/api/notes', headers: {}, ...overrides };
}

async function invoke(handler, req = request()) {
  const result = { headers: {}, status: undefined, body: undefined };
  const response = {
    statusCode: 200,
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { this.statusCode = status; return this; },
    json(payload) { result.status = this.statusCode; result.body = payload; return this; },
  };
  await handler(req, response);
  return result;
}

function observer(next, options = {}) {
  const logs = [];
  return { logs, handle: createObservedHandler(next, { resource: 'notes_collection',
    logger: record => logs.push(record), now: () => fixedTime, ...options }) };
}

function assertRecord(record, result, extra = {}) {
  assert.deepEqual(Object.keys(record).sort(), expectedKeys);
  assert.equal(record.event, 'protected_request_result');
  assert.equal(record.schema, 'aleph.http.observation.v1');
  assert.match(record.requestId, uuid);
  assert.equal(record.requestId, result.headers['X-Request-Id']);
  assert.equal(record.checkedAt, result.headers['X-Checked-At']);
  assert.equal(record.status, result.status);
  for (const [field, value] of Object.entries(extra)) assert.equal(record[field], value);
  assert.equal(JSON.stringify(record).includes(privateMarker), false);
}

test('observation preserves response payload identity and both status-setting forms for every resource', async () => {
  const payload = { id: ['synthetic', 'record'].join('-'), body: privateMarker,
    nested: { title: ['synthetic', 'title'].join('-') } };
  for (const [index, resource] of resources.entries()) {
    const status = [201, 207, 200][index];
    const { handle, logs } = observer((_req, response) => {
      if (index === 0) return response.status(status).json(payload);
      if (index === 1) response.statusCode = status;
      return response.json(payload);
    }, { resource });
    const result = await invoke(handle);
    assert.equal(result.body, payload);
    assert.equal(result.status, status);
    assert.equal(logs.length, 1);
    assertRecord(logs[0], result, { resource, method: 'GET', checkedAt: isoTime,
      errorCode: null, authorizationPresent: false, signaturePresent: false });
  }
  for (const resource of ['notes', '', null, 'untrusted-resource']) {
    assert.throws(() => createObservedHandler(() => {}, { resource }));
  }
});

test('actual 401 and 403 JSON results are recorded at response time without changing their errors', async () => {
  for (const [status, error] of [[401, 'LOGIN_REQUIRED'], [403, 'UNSIGNED_CLIENT_REQUEST'],
    [403, 'DEVICE_NOT_APPROVED'], [403, 'SIGNED_REQUEST_INVALID'], [403, 'SIGNED_REQUEST_REPLAYED']]) {
    let currentTime = fixedTime;
    const payload = { error };
    const { handle, logs } = observer((_req, response) => {
      response.status(status);
      currentTime += 1250;
      return response.json(payload);
    }, { now: () => currentTime });
    const result = await invoke(handle);
    assert.equal(result.body, payload);
    assert.equal(result.status, status);
    assert.equal(logs.length, 1);
    assertRecord(logs[0], result, { errorCode: error,
      checkedAt: new Date(fixedTime + 1250).toISOString() });
  }
});

test('client request IDs and checked-at fields cannot replace fresh server observation values', async () => {
  const spoofedId = '00000000-0000-4000-8000-000000000000';
  const spoofedTime = '2000-01-01T00:00:00.000Z';
  const { handle, logs } = observer((_req, response) => response.json({ accepted: true }));
  const req = request({ requestId: spoofedId, checkedAt: spoofedTime,
    headers: { 'x-request-id': spoofedId, 'x-checked-at': spoofedTime },
    body: { requestId: spoofedId, checkedAt: spoofedTime } });
  const results = [await invoke(handle, req), await invoke(handle, req)];
  assert.equal(logs.length, 2);
  assert.notEqual(results[0].headers['X-Request-Id'], results[1].headers['X-Request-Id']);
  for (const [index, result] of results.entries()) {
    assert.notEqual(result.headers['X-Request-Id'], spoofedId);
    assertRecord(logs[index], result, { checkedAt: isoTime });
  }
});

test('observation checks header names without reading sensitive request or payload values', async () => {
  const touched = [];
  const forbidden = name => ({ enumerable: true, get() { touched.push(name); throw new Error('forbidden fixture access'); } });
  const headers = Object.defineProperties({}, {
    Authorization: forbidden('authorization value'),
    'X-Device-Signature': forbidden('signature value'),
    'x-device-nonce': forbidden('nonce value'),
    'x-device-id': forbidden('device ID value'),
    'x-forwarded-for': forbidden('IP header value'),
  });
  const req = Object.defineProperties({ method: 'PUT', headers }, {
    url: forbidden('request URL'), query: forbidden('query'), ip: forbidden('IP'),
    body: forbidden('request body'), user: forbidden('user identity'),
  });
  const payload = Object.defineProperties({}, {
    body: forbidden('response body'), title: forbidden('response title'),
    error: forbidden('accessor error'), userId: forbidden('response user identity'),
  });
  const { handle, logs } = observer((_req, response) => response.status(403).json(payload), { resource: 'note_item' });
  const result = await invoke(handle, req);
  assert.equal(result.body, payload);
  assert.equal(result.status, 403);
  assert.deepEqual(touched, []);
  assert.equal(logs.length, 1);
  assertRecord(logs[0], result, { resource: 'note_item', method: 'PUT', errorCode: null,
    authorizationPresent: true, signaturePresent: true });
});

test('only short own uppercase error data properties and allowlisted methods enter the log', async () => {
  const inherited = Object.create({ error: 'INHERITED_ERROR' });
  const nonenumerable = Object.defineProperty({}, 'error', { value: 'SAFE_CODE_123' });
  const cases = [
    [{ error: 'SIGNED_REQUEST_INVALID' }, 'SIGNED_REQUEST_INVALID'],
    [nonenumerable, 'SAFE_CODE_123'], [inherited, null],
    [{ error: 'lowercase_error' }, null], [{ error: 'X'.repeat(200) }, null],
    [{ error: 'ERROR\nPRIVATE' }, null], [{ error: ['ARRAY_ERROR'] }, null],
    [{ error: { code: 'NESTED_ERROR' } }, null], [{ error: privateMarker }, null],
    [{ error: 403 }, null], [{}, null],
  ];
  for (const [payload, errorCode] of cases) {
    const { handle, logs } = observer((_req, response) => response.status(403).json(payload));
    const result = await invoke(handle);
    assert.equal(result.body, payload);
    assertRecord(logs[0], result, { errorCode });
  }
  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
    'get', 'TRACE', privateMarker, ['GET'], undefined]) {
    const { handle, logs } = observer((_req, response) => response.json({ accepted: true }));
    const result = await invoke(handle, request({ method }));
    assertRecord(logs[0], result, { method: typeof method === 'string'
      && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER' });
  }
});

test('a failing logger cannot change the response payload, status or observation headers', async () => {
  const payload = { error: 'DEVICE_NOT_APPROVED' };
  for (const asynchronous of [false, true]) {
    let attempts = 0;
    const { handle } = observer((_req, response) => response.status(403).json(payload), {
      logger() {
        attempts += 1;
        const error = new Error(['synthetic', 'logger', 'failure'].join('-'));
        if (asynchronous) return Promise.reject(error);
        throw error;
      },
    });
    const result = await invoke(handle);
    assert.equal(attempts, 1);
    assert.equal(result.status, 403);
    assert.equal(result.body, payload);
    assert.match(result.headers['X-Request-Id'], uuid);
    assert.equal(result.headers['X-Checked-At'], isoTime);
  }
});

test('all three actual step-12 entry points observe unauthenticated 401 responses', async () => {
  assert.ok(config.step >= 12);
  for (const [handler, method, url] of [[notesHandler, 'GET', '/api/notes'],
    [noteHandler, 'GET', '/api/notes/00000000-0000-4000-8000-000000000001'],
    [restoreHandler, 'POST', '/api/restore']]) {
    const result = await invoke(handler, request({ method, url }));
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: 'LOGIN_REQUIRED' });
    assert.match(result.headers['X-Request-Id'], uuid);
    assert.equal(new Date(result.headers['X-Checked-At']).toISOString(), result.headers['X-Checked-At']);
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
});
