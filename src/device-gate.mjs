import { createHash, webcrypto } from 'node:crypto';
import { canonicalBody, canonicalProtectedPath, canonicalRequest } from '../public/device-protocol.js';
import { DeviceError, DEVICE_ID, deviceConfiguration, deviceIdentityVerifier,
  deviceResponseHeaders, deviceFetch, readDevice, publicDeviceKey,
  deviceFailure } from './device-api.mjs';

function base64url(value, length, bytes) {
  return typeof value === 'string' && new RegExp('^[A-Za-z0-9_-]{' + length + '}$', 'u').test(value)
    && Buffer.from(value, 'base64url').length === bytes
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}

export function createDeviceGate(next, { env = process.env, fetchImpl = fetch,
  verifyAuthorization, now = Date.now } = {}) {
  if (typeof next !== 'function' || typeof now !== 'function') throw new TypeError('invalid_device_gate');
  const verifyIdentity = deviceIdentityVerifier({ env, verifyAuthorization });
  return async function handler(request, response) {
    deviceResponseHeaders(response);
    try {
      const identity = await verifyIdentity(request);
      const deviceId = request.headers?.['x-device-id'];
      const timestamp = request.headers?.['x-device-time'];
      const nonce = request.headers?.['x-device-nonce'];
      const signature = request.headers?.['x-device-signature'];
      if (typeof signature !== 'string' || !signature) {
        throw new DeviceError(403, 'UNSIGNED_CLIENT_REQUEST');
      }
      const currentTime = Math.floor(now() / 1000);
      if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId) || typeof timestamp !== 'string'
          || !/^(0|[1-9][0-9]{0,10})$/u.test(timestamp) || !Number.isSafeInteger(currentTime)
          || Math.abs(currentTime - Number(timestamp)) > 60
          || !base64url(nonce, 32, 24) || !base64url(signature, 86, 64)
          || typeof request.method !== 'string' || !/^[A-Z]{3,10}$/u.test(request.method)) {
        throw new DeviceError(403, 'SIGNED_REQUEST_INVALID');
      }
      let path, bodyHash;
      try {
        path = canonicalProtectedPath(request.url);
        const body = canonicalBody(request.body);
        if (typeof path !== 'string' || !path || typeof body !== 'string'
            || Buffer.byteLength(body) > 256 * 1024) throw new Error('invalid_canonical_request');
        bodyHash = createHash('sha256').update(body).digest('hex');
      } catch { throw new DeviceError(403, 'SIGNED_REQUEST_INVALID'); }
      const connection = deviceConfiguration(env);
      const row = await readDevice(connection, fetchImpl, deviceId);
      if (!row || row.status !== 'approved') throw new DeviceError(403, 'DEVICE_NOT_APPROVED');
      let device;
      try { device = await publicDeviceKey(row.publicJwk); }
      catch { throw new DeviceError(502, 'DEVICE_UNAVAILABLE'); }
      if (device.deviceId !== deviceId || device.fingerprint !== row.fingerprint) {
        throw new DeviceError(403, 'SIGNED_REQUEST_INVALID');
      }
      const canonical = canonicalRequest({ userId: identity.userId, deviceId,
        method: request.method, path, timestamp, nonce, bodyHash });
      let valid = false;
      try {
        valid = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' },
          device.cryptoKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(canonical));
      } catch { /* fail closed below */ }
      if (!valid) throw new DeviceError(403, 'SIGNED_REQUEST_INVALID');
      const claimed = await deviceFetch(connection, fetchImpl,
        '/rest/v1/rpc/defense_claim_device_nonce', {
          method: 'POST', body: { p_device_id: deviceId, p_nonce: nonce, p_user_id: identity.userId },
        });
      let accepted;
      try { accepted = await claimed.json(); } catch { throw new DeviceError(502, 'DEVICE_UNAVAILABLE'); }
      if (accepted === false) throw new DeviceError(403, 'SIGNED_REQUEST_REPLAYED');
      if (accepted !== true) throw new DeviceError(502, 'DEVICE_UNAVAILABLE');
    } catch (error) { return deviceFailure(response, error); }
    return next(request, response);
  };
}
