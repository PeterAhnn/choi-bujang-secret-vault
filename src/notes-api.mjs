import { randomUUID } from 'node:crypto';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from './verify-login.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const displayNote = row => {
  if (!row || !uuid.test(row.note_id ?? '') || typeof row.title !== 'string'
      || typeof row.content !== 'string' || row.title.length > 100 || row.content.length > 2000) {
    throw new Error('INVALID_NOTES');
  }
  return { id: row.note_id, title: row.title, body: row.content };
};

export function createNotesHandler({ env = process.env, fetchImpl = fetch,
  verifyAuthorization, itemRoute = false } = {}) {
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
    } catch { return response.status(401).json({ error: 'INVALID_LOGIN' }); }
    if (!uuid.test(identity?.userId ?? '')) return response.status(401).json({ error: 'INVALID_LOGIN' });
    const allowed = itemRoute ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
    if (!allowed.includes(request.method)) {
      response.setHeader('Allow', allowed.join(', '));
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    let noteId;
    if (itemRoute) {
      try { noteId = /^\/api\/notes\/([^/]+)$/u.exec(new URL(request.url, 'https://library.invalid').pathname)?.[1]; }
      catch { /* handled below */ }
      if (!uuid.test(noteId ?? '')) return response.status(400).json({ error: 'INVALID_NOTE_ID' });
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
    let values;
    if (request.method === 'POST' || request.method === 'PUT') {
      const body = request.body;
      if (request.method === 'PUT' && body && typeof body === 'object'
          && Object.keys(body).some(field => !['title', 'body'].includes(field))) {
        return response.status(400).json({ error: 'INVALID_NOTE' });
      }
      if (!body || Array.isArray(body) || typeof body !== 'object'
          || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 100
          || typeof body.body !== 'string' || !body.body.trim() || body.body.length > 2000) {
        return response.status(400).json({ error: 'INVALID_NOTE' });
      }
      values = { title: body.title, content: body.body };
      if (request.method === 'POST') {
        if (body.id !== undefined && !uuid.test(body.id)) return response.status(400).json({ error: 'INVALID_NOTE_ID' });
        values.note_id = body.id || randomUUID();
        values.owner_id = identity.userId;
      }
    }
    try {
      const url = new URL('/rest/v1/defense_notes', base);
      url.searchParams.set('select', 'note_id,title,content');
      if (itemRoute) {
        url.searchParams.set('note_id', `eq.${noteId}`);
        // Apply ownership to the same read/update/delete statement to avoid a race.
        // Updates only carry title/content, so ownership cannot change in the new row.
        url.searchParams.set('owner_id', `eq.${identity.userId}`);
      } else if (request.method === 'GET') {
        url.searchParams.set('owner_id', `eq.${identity.userId}`);
        url.searchParams.set('order', 'id.asc');
        url.searchParams.set('limit', '100');
      }
      const upstream = await fetchImpl(url, {
        method: request.method === 'PUT' ? 'PATCH' : request.method,
        headers: { apikey: key, Accept: 'application/json',
          ...(values ? { 'Content-Type': 'application/json' } : {}),
          ...(request.method !== 'GET' ? { Prefer: 'return=representation' } : {}) },
        ...(values ? { body: JSON.stringify(values) } : {}),
        redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
      });
      if (!upstream.ok) {
        if (upstream.status === 409) return response.status(409).json({ error: 'NOTE_EXISTS' });
        throw new Error('UPSTREAM_FAILED');
      }
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length > 100) throw new Error('INVALID_NOTES');
      if (itemRoute && rows.length === 0) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      if (itemRoute && rows.length !== 1) throw new Error('INVALID_NOTES');
      if (request.method === 'DELETE') return response.status(200).json({ id: noteId });
      const notes = rows.map(displayNote);
      if (request.method === 'POST') {
        if (notes.length !== 1) throw new Error('INVALID_NOTES');
        return response.status(201).json({ id: notes[0].id });
      }
      return response.status(200).json(itemRoute ? notes[0] : notes);
    } catch { return response.status(502).json({ error: 'NOTES_UNAVAILABLE' }); }
  };
}
