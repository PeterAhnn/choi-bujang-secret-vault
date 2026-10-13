import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from './verify-login.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function createRestoreHandler({ env = process.env, fetchImpl = fetch, verifyAuthorization } = {}) {
  let verifier = verifyAuthorization;
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const authorization = request.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization) return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    let identity;
    try {
      verifier ??= createLoginVerifier({ config, supabaseSecretKey: env.SUPABASE_SECRET_KEY });
      identity = await verifier(authorization);
    } catch { return response.status(401).json({ error: 'INVALID_LOGIN' }); }
    if (typeof identity?.userId !== 'string' || !uuid.test(identity.userId)) return response.status(401).json({ error: 'INVALID_LOGIN' });
    let requested;
    try { requested = new URL(request.url, 'https://library.invalid'); } catch { /* rejected below */ }
    if (requested?.pathname !== '/api/restore' || requested.search || requested.hash) {
      return response.status(403).json({ error: 'RESOURCE_NOT_ALLOWED' });
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).join(',') !== 'id' || typeof body.id !== 'string' || !uuid.test(body.id)) {
      return response.status(400).json({ error: 'INVALID_RESTORE_TARGET' });
    }
    const noteId = body.id.toLowerCase();
    let base;
    try { base = new URL(env.SUPABASE_URL); } catch { /* rejected below */ }
    const key = env.SUPABASE_SECRET_KEY;
    if (!base || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
        || base.pathname !== '/' || !/^[a-z0-9]+\.supabase\.co$/u.test(base.hostname)
        || typeof key !== 'string' || !key.startsWith('sb_secret_')) {
      return response.status(503).json({ error: 'RESTORE_NOT_CONFIGURED' });
    }
    try {
      const upstream = await fetchImpl(new URL('/rest/v1/rpc/defense_restore_note', base), {
        method: 'POST', headers: { apikey: key, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_note_id: noteId, p_owner_id: identity.userId }),
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      const data = await upstream.json();
      if (!upstream.ok) {
        if (data?.message === 'backup_not_found') return response.status(404).json({ error: 'BACKUP_NOT_FOUND' });
        if (data?.message === 'restore_denied') return response.status(403).json({ error: 'RESTORE_DENIED' });
        if (data?.message === 'backup_invalid' || data?.code === '23505') {
          return response.status(409).json({ error: 'BACKUP_CONFLICT' });
        }
        throw new Error('restore_failed');
      }
      if (data?.id !== noteId || data.restored !== true || !/^[a-f0-9]{64}$/u.test(data.contentHash ?? '')) {
        throw new Error('invalid_restore_result');
      }
      return response.status(200).json({ id: data.id, restored: true, contentHash: data.contentHash });
    } catch { return response.status(502).json({ error: 'RESTORE_UNAVAILABLE' }); }
  };
}
