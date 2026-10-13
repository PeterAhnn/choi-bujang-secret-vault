export function canonicalBody(body) {
  if (body === undefined) return '';
  function normalize(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
    }
    throw new Error('INVALID_SIGNED_BODY');
  }
  return JSON.stringify(normalize(body));
}
export function canonicalProtectedPath(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/') || rawUrl.startsWith('//') || /[\r\n#]/u.test(rawUrl)) {
    throw new Error('INVALID_SIGNED_PATH');
  }
  const url = new URL(rawUrl, 'https://library.invalid');
  if (url.origin !== 'https://library.invalid') throw new Error('INVALID_SIGNED_PATH');
  const item = /^\/api\/notes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/iu.exec(url.pathname);
  if (item && [...url.searchParams].length === 1 && url.searchParams.getAll('id').length === 1
      && url.searchParams.get('id') === item[1]) url.searchParams.delete('id');
  return url.pathname + url.search;
}
export function canonicalRequest({ userId, deviceId, method, path, timestamp, nonce, bodyHash }) {
  return ['DEFENSE-DEVICE-V1', userId, deviceId, method, path, timestamp, nonce, bodyHash].join('\n');
}
export function publicJwkCanonical(jwk) {
  return JSON.stringify({ crv: 'P-256', kty: 'EC', x: jwk.x, y: jwk.y });
}
