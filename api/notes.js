import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

export function createNotesHandler({ env = process.env, fetchImpl = fetch,
  verifyAuthorization } = {}) {
  let verifier = verifyAuthorization;
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const authorization = request.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization) {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    let identity;
    try {
      verifier ??= createLoginVerifier({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verifier(authorization);
    } catch {
      return response.status(401).json({ error: 'INVALID_LOGIN' });
    }
    if (!identity?.userId) return response.status(401).json({ error: 'INVALID_LOGIN' });
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    let base;
    try { base = new URL(env.SUPABASE_URL); } catch { /* handled below */ }
    const key = env.SUPABASE_SECRET_KEY;
    if (!base || base.protocol !== 'https:' || base.username || base.password
        || base.search || base.hash || base.pathname !== '/'
        || !/^[a-z0-9]+\.supabase\.co$/u.test(base.hostname)
        || typeof key !== 'string' || !key.startsWith('sb_secret_')) {
      return response.status(503).json({ error: 'NOTES_NOT_CONFIGURED' });
    }
    try {
      const url = new URL('/rest/v1/defense_notes', base);
      url.searchParams.set('select', 'title,content');
      url.searchParams.set('order', 'id.asc');
      url.searchParams.set('limit', '4');
      const upstream = await fetchImpl(url, {
        headers: { apikey: key, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
      });
      if (!upstream.ok) throw new Error('UPSTREAM_FAILED');
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length > 4 || rows.some(row => !row
          || typeof row.title !== 'string' || typeof row.content !== 'string'
          || row.title.length > 100 || row.content.length > 2000)) {
        throw new Error('INVALID_NOTES');
      }
      // Return only the two display fields; never forward provider errors or headers.
      return response.status(200).json({
        sampleMarker: 'SAMPLE_NOTE_1',
        notes: rows.map(({ title, content }) => ({ title, content })),
      });
    } catch {
      return response.status(502).json({ error: 'NOTES_UNAVAILABLE' });
    }
  };
}

export default createNotesHandler();
