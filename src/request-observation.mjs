import { randomUUID } from 'node:crypto';

const resources = new Set(['notes_collection', 'note_item', 'restore']);
const methods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);
const defaultLogger = record => console.info(JSON.stringify(record));

function headerPresent(headers, expected) {
  if (!headers || typeof headers !== 'object') return false;
  try { return Object.getOwnPropertyNames(headers).some(name => name.toLowerCase() === expected); }
  catch { return false; }
}

function safeErrorCode(payload) {
  if (!payload || typeof payload !== 'object') return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(payload, 'error');
    const value = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
    return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(value) ? value : null;
  } catch { return null; }
}

function checkedTime(now) {
  try {
    const value = now();
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  } catch { /* Observation failures must not alter the protected response. */ }
  return new Date().toISOString();
}

export function createObservedHandler(next, { resource, logger = defaultLogger,
  now = Date.now } = {}) {
  if (typeof next !== 'function' || !resources.has(resource)
      || typeof logger !== 'function' || typeof now !== 'function') {
    throw new TypeError('invalid_request_observation');
  }
  return async function handler(request, response) {
    const requestId = randomUUID();
    const method = methods.has(request.method) ? request.method : 'OTHER';
    const authorizationPresent = headerPresent(request.headers, 'authorization');
    const signaturePresent = headerPresent(request.headers, 'x-device-signature');
    const originalJson = response.json;
    response.setHeader('X-Request-Id', requestId);
    response.json = function observedJson(payload) {
      const checkedAt = checkedTime(now);
      const status = Number.isInteger(this.statusCode) && this.statusCode >= 100
        && this.statusCode <= 599 ? this.statusCode : null;
      this.setHeader('X-Request-Id', requestId);
      this.setHeader('X-Checked-At', checkedAt);
      const record = {
        event: 'protected_request_result', schema: 'aleph.http.observation.v1',
        requestId, checkedAt, resource, method, status, errorCode: safeErrorCode(payload),
        authorizationPresent, signaturePresent,
      };
      try { void Promise.resolve(logger(record)).catch(() => {}); }
      catch { /* Never change an allow/deny result because logging failed. */ }
      return originalJson.call(this, payload);
    };
    try { return await next(request, response); }
    finally { response.json = originalJson; }
  };
}
