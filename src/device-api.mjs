import { createHash, webcrypto } from 'node:crypto';
import config from '../aleph.config.json' with { type: 'json' };
import { publicJwkCanonical } from '../public/device-protocol.js';
import { createLoginVerifier } from './verify-login.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const DEVICE_ID = /^[0-9a-f]{16}$/u;
const FINGERPRINT = /^[0-9a-f]{64}$/u;
const STATUSES = new Set(['pending', 'approved', 'denied', 'revoked']);
const ownKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export class DeviceError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function deviceResponseHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

export function deviceConfiguration(env) {
  let base;
  try { base = new URL(env.SUPABASE_URL); } catch { /* fail closed below */ }
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || base.protocol !== 'https:' || base.username || base.password || base.port
      || base.pathname !== '/' || base.search || base.hash
      || !/^[a-z0-9]+\.supabase\.co$/u.test(base.hostname)
      || typeof key !== 'string' || !/^sb_secret_[A-Za-z0-9_-]+$/u.test(key)) {
    throw new DeviceError(503, 'DEVICE_NOT_CONFIGURED');
  }
  return { base, key };
}

export function deviceIdentityVerifier({ env, verifyAuthorization }) {
  let verifier = verifyAuthorization;
  return async request => {
    const authorization = request.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization) {
      throw new DeviceError(401, 'LOGIN_REQUIRED');
    }
    let identity;
    try {
      verifier ??= createLoginVerifier({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verifier(authorization);
    } catch { throw new DeviceError(401, 'INVALID_LOGIN'); }
    if (typeof identity?.userId !== 'string' || !UUID.test(identity.userId)) throw new DeviceError(401, 'INVALID_LOGIN');
    return identity;
  };
}

export async function publicDeviceKey(publicKey) {
  if (!ownKeys(publicKey, ['crv', 'kty', 'x', 'y'])
      || publicKey.crv !== 'P-256' || publicKey.kty !== 'EC'
      || [publicKey.x, publicKey.y].some(value => typeof value !== 'string'
        || !/^[A-Za-z0-9_-]{43}$/u.test(value)
        || Buffer.from(value, 'base64url').length !== 32
        || Buffer.from(value, 'base64url').toString('base64url') !== value)) {
    throw new DeviceError(400, 'INVALID_DEVICE_KEY');
  }
  const jwk = { crv: 'P-256', kty: 'EC', x: publicKey.x, y: publicKey.y };
  let cryptoKey;
  try {
    cryptoKey = await webcrypto.subtle.importKey('jwk', jwk,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch { throw new DeviceError(400, 'INVALID_DEVICE_KEY'); }
  const fingerprint = createHash('sha256').update(publicJwkCanonical(jwk)).digest('hex');
  return { jwk, cryptoKey, fingerprint, deviceId: fingerprint.slice(0, 16) };
}

export async function deviceFetch(connection, fetchImpl, path, { method = 'GET',
  params = {}, body, prefer } = {}) {
  const url = new URL(path, connection.base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let upstream;
  try {
    upstream = await fetchImpl(url, {
      method, headers: { apikey: connection.key, Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(prefer ? { Prefer: prefer } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
  } catch { throw new DeviceError(502, 'DEVICE_UNAVAILABLE'); }
  if (!upstream?.ok) {
    if (upstream?.status === 409 && method === 'POST' && path === '/rest/v1/defense_devices') {
      throw new DeviceError(409, 'DEVICE_ID_CONFLICT');
    }
    throw new DeviceError(502, 'DEVICE_UNAVAILABLE');
  }
  return upstream;
}

export async function readDevice(connection, fetchImpl, deviceId) {
  const upstream = await deviceFetch(connection, fetchImpl, '/rest/v1/defense_devices', {
    params: { device_id: 'eq.' + deviceId, select: 'device_id,fingerprint,public_jwk,status', limit: '2' },
  });
  let rows;
  try { rows = await upstream.json(); } catch { throw new DeviceError(502, 'DEVICE_UNAVAILABLE'); }
  if (!Array.isArray(rows) || rows.length > 1) throw new DeviceError(502, 'DEVICE_UNAVAILABLE');
  if (!rows.length) return null;
  const row = rows[0];
  if (!row || row.device_id !== deviceId || typeof row.fingerprint !== 'string' || !FINGERPRINT.test(row.fingerprint)
      || !STATUSES.has(row.status) || !ownKeys(row.public_jwk, ['crv', 'kty', 'x', 'y'])) {
    throw new DeviceError(502, 'DEVICE_UNAVAILABLE');
  }
  return { deviceId: row.device_id, fingerprint: row.fingerprint,
    publicJwk: row.public_jwk, status: row.status };
}

export function deviceFailure(response, error) {
  if (error instanceof DeviceError) return response.status(error.status).json({ error: error.code });
  return response.status(502).json({ error: 'DEVICE_UNAVAILABLE' });
}

export function createDeviceHandler({ route, env = process.env, fetchImpl = fetch,
  verifyAuthorization } = {}) {
  if (!['request', 'status'].includes(route)) throw new TypeError('invalid_device_route');
  const verifyIdentity = deviceIdentityVerifier({ env, verifyAuthorization });
  return async function handler(request, response) {
    deviceResponseHeaders(response);
    try {
      const identity = await verifyIdentity(request);
      const method = route === 'request' ? 'POST' : 'GET';
      if (request.method !== method) {
        response.setHeader('Allow', method);
        throw new DeviceError(405, 'METHOD_NOT_ALLOWED');
      }
      let url;
      try { url = new URL(request.url, 'https://library.invalid'); }
      catch { throw new DeviceError(400, 'INVALID_DEVICE_REQUEST'); }
      if (url.pathname !== '/api/device/' + route || url.hash) {
        throw new DeviceError(400, 'INVALID_DEVICE_REQUEST');
      }
      let deviceId, submitted;
      if (route === 'request') {
        if (url.search || !ownKeys(request.body, ['publicKey'])) {
          throw new DeviceError(400, 'INVALID_DEVICE_REQUEST');
        }
        submitted = await publicDeviceKey(request.body.publicKey);
        deviceId = submitted.deviceId;
      } else {
        const entries = [...url.searchParams];
        if (entries.length !== 1 || entries[0][0] !== 'id'
            || !DEVICE_ID.test(entries[0][1])) throw new DeviceError(400, 'INVALID_DEVICE_REQUEST');
        deviceId = entries[0][1];
      }
      const connection = deviceConfiguration(env);
      if (submitted) {
        await deviceFetch(connection, fetchImpl, '/rest/v1/defense_devices', {
          method: 'POST', params: { on_conflict: 'device_id' },
          body: { device_id: deviceId, fingerprint: submitted.fingerprint,
            public_jwk: submitted.jwk, requested_by: identity.userId },
          prefer: 'resolution=ignore-duplicates,return=minimal',
        });
      }
      const row = await readDevice(connection, fetchImpl, deviceId);
      if (!row) throw new DeviceError(submitted ? 502 : 404,
        submitted ? 'DEVICE_UNAVAILABLE' : 'DEVICE_NOT_FOUND');
      if (submitted && (row.fingerprint !== submitted.fingerprint
          || publicJwkCanonical(row.publicJwk) !== publicJwkCanonical(submitted.jwk))) {
        throw new DeviceError(409, 'DEVICE_ID_CONFLICT');
      }
      if (!submitted) {
        let stored;
        try { stored = await publicDeviceKey(row.publicJwk); }
        catch { throw new DeviceError(502, 'DEVICE_UNAVAILABLE'); }
        if (stored.deviceId !== row.deviceId || stored.fingerprint !== row.fingerprint) {
          throw new DeviceError(502, 'DEVICE_UNAVAILABLE');
        }
      }
      // A request can insert public material only. Approval is never written here.
      return response.status(200).json({ deviceId: row.deviceId,
        fingerprint: row.fingerprint, status: row.status });
    } catch (error) { return deviceFailure(response, error); }
  };
}
