import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { createNotesHandler } from '../api/notes.js';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

const root = resolve(import.meta.dirname, '..');
const syntheticKey = ['sb', 'secret', 'fixture'].join('_');
const env = { SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SECRET_KEY: syntheticKey };
const syntheticNotes = Array.from({ length: 4 }, (_, index) => ({
  note_id: `11111111-1111-4111-8111-11111111111${index}`,
  title: `Synthetic ${index + 1}`, content: `Synthetic value ${index + 1}`,
}));
const config = {
  step: 2, repoUrl: 'https://github.com/Student-A/aleph-defense',
  publicAppUrl: 'https://student-defense.vercel.app/', sampleMarker: 'SAMPLE_NOTE_1',
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
};
const deploymentEnv = {
  VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

async function callHandler({ method = 'GET', headers = { authorization: 'verified-fixture' }, settings = env,
  fetchImpl = async () => new Response(JSON.stringify(syntheticNotes)) } = {}) {
  const result = { headers: new Map() };
  const response = {
    setHeader(name, value) { result.headers.set(name.toLowerCase(), value); },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  await createNotesHandler({ env: settings, fetchImpl,
    verifyAuthorization: async () => ({ userId: '11111111-1111-4111-8111-111111111111' }) })({ method, headers }, response);
  return result;
}

test('collection rejects DELETE before making a provider request', async () => {
  const response = await callHandler({ method: 'DELETE', fetchImpl() { assert.fail('provider request forbidden'); } });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(response.body, { error: 'METHOD_NOT_ALLOWED' });
});

test('notes returns 503 for missing or unsafe server configuration', async () => {
  for (const settings of [{}, { SUPABASE_URL: env.SUPABASE_URL },
    { ...env, SUPABASE_URL: 'https://syntheticproject.supabase.co/?untrusted=1' }]) {
    const response = await callHandler({ settings, fetchImpl() { assert.fail('provider request forbidden'); } });
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: 'NOTES_NOT_CONFIGURED' });
  }
});

test('notes sanitizes provider HTTP, JSON, redirect and network failures', async () => {
  const providers = [
    async () => new Response(JSON.stringify({ message: syntheticKey }), { status: 401 }),
    async () => new Response('<invalid-json>', { status: 200 }),
    async () => new Response('', { status: 302, headers: { location: 'https://example.org/' } }),
    async () => { throw new Error(`provider detail ${syntheticKey}`); },
    async () => new Response(JSON.stringify([{ title: 'Incomplete' }])),
    async () => new Response(JSON.stringify(Array(101).fill(syntheticNotes[0]))),
  ];
  for (const fetchImpl of providers) {
    const response = await callHandler({ fetchImpl });
    assert.equal(response.status, 502);
    assert.deepEqual(response.body, { error: 'NOTES_UNAVAILABLE' });
    assert.ok(!JSON.stringify(response.body).includes(syntheticKey));
  }
});

test('notes sends only server credentials and strips extra provider fields', async () => {
  let requestedUrl;
  let requestedOptions;
  const rows = syntheticNotes.map(note => ({ ...note, secret: syntheticKey, owner_email: 'synthetic-contact' }));
  const response = await callHandler({ headers: { authorization: 'untrusted-client-value', cookie: 'untrusted-client-cookie' },
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(JSON.stringify(rows));
    } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, syntheticNotes.map(note => ({ id: note.note_id, title: note.title, body: note.content })));
  assert.equal(requestedUrl.origin, env.SUPABASE_URL);
  assert.equal(requestedUrl.pathname, '/rest/v1/defense_notes');
  assert.equal(requestedUrl.searchParams.get('select'), 'note_id,title,content');
  assert.equal(requestedUrl.searchParams.get('owner_id'), 'eq.11111111-1111-4111-8111-111111111111');
  assert.equal(requestedUrl.searchParams.get('order'), 'id.asc');
  assert.equal(requestedUrl.searchParams.get('limit'), '100');
  assert.deepEqual(requestedOptions.headers, { apikey: syntheticKey, Accept: 'application/json' });
  assert.equal(requestedOptions.redirect, 'error');
  assert.equal(requestedOptions.cache, 'no-store');
});

test('deployment identity preserves current step and Vercel Git source', () => {
  const identity = deploymentIdentity(deploymentEnv, config);
  assert.equal(identity.step, 2);
  assert.equal(identity.repoUrl, 'https://github.com/student-a/aleph-defense');
  assert.equal(identity.commit, deploymentEnv.VERCEL_GIT_COMMIT_SHA);
  assert.equal(identity.judgeIssuer, config.judgeIssuer);
  assert.throws(() => deploymentIdentity(deploymentEnv, { ...config, step: 0 }));
  assert.throws(() => deploymentIdentity(deploymentEnv, { ...config, step: 13 }));
});

test('actual step 2 build removes stale static notes and preserves aleph identity', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'aleph-defense-step-02-'));
  try {
    await mkdir(join(sandbox, 'scripts'));
    await mkdir(join(sandbox, 'public'));
    await cp(join(root, 'scripts', 'build-public.mjs'), join(sandbox, 'scripts', 'build-public.mjs'));
    await cp(join(root, 'scripts', 'deployment-identity.mjs'), join(sandbox, 'scripts', 'deployment-identity.mjs'));
    await writeFile(join(sandbox, 'aleph.config.json'), JSON.stringify(config));
    await writeFile(join(sandbox, 'data.json'), JSON.stringify({ sampleMarker: config.sampleMarker, notes: [] }));
    await writeFile(join(sandbox, 'public', 'data.json'), JSON.stringify({ notes: syntheticNotes }));
    execFileSync(process.execPath, [join(sandbox, 'scripts', 'build-public.mjs')], {
      cwd: sandbox, env: { ...process.env, ...deploymentEnv }, encoding: 'utf8', windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const staticText = await readFile(join(sandbox, 'public', 'data.json'), 'utf8');
    assert.deepEqual(JSON.parse(staticText), { notes: [] });
    assert.ok(!staticText.includes(config.sampleMarker));
    assert.ok(!staticText.includes(syntheticNotes[0].content));
    const identity = JSON.parse(await readFile(join(sandbox, 'public', 'aleph.json'), 'utf8'));
    assert.deepEqual(identity, deploymentIdentity(deploymentEnv, config));
    await writeFile(join(sandbox, 'data.json'), JSON.stringify({ notes: syntheticNotes }));
    assert.throws(() => execFileSync(process.execPath, [join(sandbox, 'scripts', 'build-public.mjs'), '--local'], {
      cwd: sandbox, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } finally {
    assert.ok(resolve(sandbox).startsWith(`${resolve(tmpdir())}${sep}aleph-defense-step-02-`));
    await rm(sandbox, { recursive: true, force: true });
  }
});

function checkerResponse(path, localCommit, overrides = {}) {
  const bodies = {
    '/': '<!doctype html><title>Synthetic library</title>',
    '/data.json': { notes: [] },
    '/aleph.json': { ...deploymentIdentity(deploymentEnv, config), commit: localCommit },
    '/api/notes': { sampleMarker: config.sampleMarker, notes: syntheticNotes.map(({ title, content }) => ({ title, content })) },
  };
  if (overrides[path]) return overrides[path]();
  return new Response(path === '/' ? bodies[path] : JSON.stringify(bodies[path]), {
    status: 200, headers: { 'x-content-type-options': 'nosniff',
      'content-type': path === '/' ? 'text/html' : 'application/json' },
  });
}

test('step 2 checker makes four anonymous requests and checks the real local HEAD', async () => {
  const originalFetch = globalThis.fetch;
  const localCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ path: url.pathname, options });
      return checkerResponse(url.pathname, localCommit);
    };
    const results = await runAttackChecks(config);
    assert.deepEqual(calls.map(call => call.path).sort(), ['/', '/aleph.json', '/api/notes', '/data.json']);
    assert.equal(results.length, 5);
    for (const item of results) {
      assert.deepEqual(Object.keys(item).sort(), ['attackId', 'expected', 'observed']);
      assert.ok(!item.observed.includes(syntheticNotes[0].content));
      assert.ok(!/실패|불일치/u.test(item.observed));
    }
    assert.match(results.find(item => item.attackId === 'deployment_identity').observed, /일치/u);
    assert.match(results.find(item => item.attackId === 'anonymous_api_read').observed, /4건/u);
    for (const { options } of calls) {
      assert.equal(options.method, 'GET');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.ok(!('authorization' in options.headers));
      assert.ok(!('cookie' in options.headers));
    }
    globalThis.fetch = async url => checkerResponse(url.pathname, 'b'.repeat(40));
    const mismatch = await runAttackChecks(config);
    assert.match(mismatch.find(item => item.attackId === 'deployment_identity').observed, /불일치/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('step 2 checker records malformed JSON, provider failures, redirects and missing headers', async () => {
  const originalFetch = globalThis.fetch;
  const localCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
  try {
    for (const badResponse of [
      () => new Response('<bad-json>', { headers: { 'x-content-type-options': 'nosniff' } }),
      () => new Response(JSON.stringify({ error: 'NOTES_UNAVAILABLE' }), { status: 502 }),
      () => new Response('', { status: 302 }),
      () => { throw new Error(`failure detail ${syntheticKey}`); },
    ]) {
      globalThis.fetch = async url => checkerResponse(url.pathname, localCommit, { '/api/notes': badResponse });
      const results = await runAttackChecks(config);
      const observed = results.find(item => item.attackId === 'anonymous_api_read').observed;
      assert.ok(!observed.includes('4건과 표시 필드만 확인'));
      assert.ok(!observed.includes(syntheticKey));
    }
    globalThis.fetch = async url => checkerResponse(url.pathname, localCommit, {
      '/data.json': () => new Response('<not-found>', { status: 404, headers: { 'x-content-type-options': 'nosniff' } }),
    });
    const missingStatic = await runAttackChecks(config);
    assert.match(missingStatic.find(item => item.attackId === 'static_notes_removed').observed, /404 확인/u);
    globalThis.fetch = async url => checkerResponse(url.pathname, localCommit, {
      '/data.json': () => new Response(JSON.stringify({ sampleMarker: config.sampleMarker, notes: [] }), {
        headers: { 'x-content-type-options': 'nosniff' },
      }),
    });
    const staleMarker = await runAttackChecks(config);
    assert.match(staleMarker.find(item => item.attackId === 'static_notes_removed').observed, /불일치/u);
    globalThis.fetch = async url => checkerResponse(url.pathname, localCommit, {
      '/data.json': () => new Response(JSON.stringify({ notes: syntheticNotes })),
    });
    const exposed = await runAttackChecks(config);
    assert.match(exposed.find(item => item.attackId === 'static_notes_removed').observed, /불일치/u);
    assert.match(exposed.find(item => item.attackId === 'security_nosniff').observed, /data\.json/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
