import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// These are student self-checks, not the judge's decision.
// Never return tokens, private keys, real names, or note bodies.
const root = resolve(import.meta.dirname, '..');
const normalizeRepo = value => {
  if (typeof value !== 'string') return null;
  const match = /^https:\/\/github\.com\/([a-z0-9-]+)\/([a-z0-9._-]+)\/?$/iu.exec(value);
  return match ? `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase().replace(/\.git$/u, '')}` : null;
};
const result = (attackId, expected, observed) => ({ attackId, expected, observed });

async function requestPath(app, path, wantsJson = false, method = 'GET', authorization, attackId) {
  try {
    const response = await fetch(new URL(path, app), {
      method, credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Accept: wantsJson ? 'application/json' : 'text/html',
        ...(authorization ? { Authorization: authorization } : {}),
        ...(attackId ? { 'x-aleph-attack-id': attackId } : {}) },
      ...(attackId ? { attackId } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (response.redirected || response.status >= 300 && response.status < 400) {
      return { status: response.status, failed: '리다이렉트 응답', headers: response.headers };
    }
    if (!wantsJson) return { status: response.status, ok: response.ok, headers: response.headers };
    let data;
    try { data = await response.json(); } catch {
      return { status: response.status, failed: 'JSON 형식 오류', headers: response.headers };
    }
    return { status: response.status, ok: response.ok, headers: response.headers, data };
  } catch {
    // Provider/network error text may contain request details; do not forward it.
    return { failed: '요청 실패 또는 리다이렉트 거부' };
  }
}

function failure(request) {
  const status = Number.isInteger(request.status) ? ` (HTTP ${request.status})` : '';
  return `${request.failed || '검증 조건 불일치'}${status}`;
}

async function runStepTwoChecks(config, app) {
  let localCommit;
  try {
    const sha = execFileSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD'], {
      encoding: 'utf8', timeout: 5000, windowsHide: true, maxBuffer: 4096,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (/^[a-f0-9]{40,64}$/u.test(sha)) localCommit = sha;
  } catch { /* Record identity failure after making the actual requests. */ }
  const paths = ['/', '/data.json', '/aleph.json', '/api/notes'];
  const requests = await Promise.all(paths.map(path => requestPath(app, path, path !== '/')));
  const [page, staticData, identity, api] = requests;
  const staticGone = !staticData.failed && staticData.ok
    && Array.isArray(staticData.data?.notes) && staticData.data.notes.length === 0
    && !JSON.stringify(staticData.data).includes(config.sampleMarker);
  // A real 404 also removes the static endpoint, even when its body is HTML.
  const staticNotFound = staticData.status === 404 && staticData.failed !== '리다이렉트 응답';
  const repo = normalizeRepo(config.repoUrl);
  const identityMatches = !identity.failed && identity.ok && localCommit && repo
    && identity.data?.schema === 'aleph.defense.deployment.v1' && identity.data.step === 2
    && normalizeRepo(identity.data.repoUrl) === repo && identity.data.commit === localCommit
    && identity.data.sampleMarker === config.sampleMarker
    && identity.data.judgeIssuer === config.judgeIssuer;
  const apiHasFour = !api.failed && api.ok && api.data?.sampleMarker === config.sampleMarker
    && Array.isArray(api.data.notes) && api.data.notes.length === 4
    && api.data.notes.every(note => note && typeof note.title === 'string'
      && typeof note.content === 'string' && Object.keys(note).sort().join(',') === 'content,title');
  const missingHeaders = paths.filter((path, index) =>
    requests[index].headers?.get('x-content-type-options')?.toLowerCase() !== 'nosniff');
  return [
    result('anonymous_page', '비로그인 GET / 응답 HTTP 200',
      page.ok && !page.failed && page.status === 200 ? '비로그인 화면 HTTP 200 확인' : failure(page)),
    result('static_notes_removed', '비로그인 GET /data.json의 메모·1단계 확인 표시 없음 또는 HTTP 404',
      staticNotFound ? '정적 자료 경로 HTTP 404 확인' : staticGone
        ? '정적 자료의 메모 0건·1단계 확인 표시 없음 확인' : failure(staticData)),
    result('deployment_identity', 'GET /aleph.json의 2단계·저장소·커밋이 로컬 HEAD와 일치',
      identityMatches ? '2단계·저장소·커밋·심판 주소·확인 표시가 로컬 설정과 일치'
        : !localCommit ? '로컬 HEAD 커밋 확인 실패' : failure(identity)),
    result('security_nosniff', '네 공개 경로에 X-Content-Type-Options: nosniff 적용',
      missingHeaders.length ? `nosniff 확인 실패 경로: ${missingHeaders.join(', ')}`
        : '네 공개 경로에서 nosniff 헤더 확인'),
    result('anonymous_api_read', '비로그인 GET /api/notes에서 가상 자료 4건 확인',
      apiHasFour ? '서버 API의 가상 자료 4건과 표시 필드만 확인' : failure(api)),
  ];
}

async function runStepThreeChecks(config, app) {
  const item = '/api/notes/00000000-0000-4000-8000-000000000001';
  const attempts = [
    ['anonymous_list', '/api/notes', 'GET'],
    ['anonymous_create', '/api/notes', 'POST'],
    ['anonymous_item', item, 'GET'],
    ['anonymous_update', item, 'PUT'],
    ['anonymous_delete', item, 'DELETE'],
    ['invalid_login', '/api/notes', 'GET', 'Bearer invalid'],
  ];
  const replies = await Promise.all(attempts.map(([attackId, path, method, authorization]) =>
    config.step === 12 && !['GET', 'HEAD'].includes(method) ? { notRun: true }
      : requestPath(app, path, true, method, authorization, config.step === 12 ? attackId : undefined)));
  const rejected = replies.map((reply, index) => result(attempts[index][0],
    '로그인 검사 실패 요청은 자료 없이 JSON401/403으로 거부',
    reply.notRun ? 'not_run'
      : !reply.failed && [401, 403].includes(reply.status) && typeof reply.data?.error === 'string'
      && Object.keys(reply.data).join(',') === 'error'
      ? `자료 없이 JSON HTTP ${reply.status} 거부 확인` : failure(reply)));
  const [page, staticData, identity] = await Promise.all([
    requestPath(app, '/', false, 'GET', undefined, config.step === 12 ? 'anonymous_page' : undefined),
    requestPath(app, '/data.json', true, 'GET', undefined, config.step === 12 ? 'static_notes_removed' : undefined),
    requestPath(app, '/aleph.json', true, 'GET', undefined, config.step === 12 ? 'deployment_identity' : undefined),
  ]);
  const head = execFileSync('git', ['-C', root, 'rev-parse', '--verify', 'HEAD'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const identityMatches = identity.ok && identity.data?.step === config.step && identity.data.commit === head
    && normalizeRepo(identity.data.repoUrl) === normalizeRepo(config.repoUrl)
    && (config.step < 10 || identity.data.restoreRoute === config.restoreRoute)
    && new URL(identity.data.publicAppUrl).origin === app.origin
    && identity.data.judgeIssuer === config.judgeIssuer;
  const staticGone = staticData.status === 404 || staticData.ok && !staticData.failed
    && Array.isArray(staticData.data?.notes) && staticData.data.notes.length === 0
    && !JSON.stringify(staticData.data).includes(config.sampleMarker);
  return [...rejected,
    result('anonymous_page', '비로그인 로그인 화면 HTTP200', page.ok ? 'HTTP200 확인' : failure(page)),
    result('static_notes_removed', '정적 메모와1단계 확인 표시 없음', staticGone ? '정적 메모0건·확인 표시 없음 확인' : failure(staticData)),
    result('deployment_identity', `${config.step}단계 배포 식별이 현재 저장소·HEAD·심판 주소와 일치`, identityMatches ? `${config.step}단계 배포 식별 일치 확인` : failure(identity)),
    result('security_nosniff', '첫 화면의 nosniff 보안 헤더', page.headers?.get('x-content-type-options') === 'nosniff' ? 'nosniff 확인' : 'nosniff 확인 실패'),
  ];
}

export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  if ([6, 7, 8, 9, 10, 11, 12].includes(config.step)) {
    const { decide, RULE_IDS } = await import('./decider.mjs');
    const { checkDecider } = await import('../scripts/decider-test.mjs');
    const checks = await checkDecider({ decide, ruleIds: RULE_IDS });
    const attempts = checks.map((check, index) => result(`device_fixture_${index + 1}`,
      check.name, config.step === 12 ? 'not_run'
        : `가상 요청 연습: ${check.passed ? '통과' : '실패'} · ${check.name}`));
    if (config.step === 8) {
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const normal = fixtureRequests().normal;
      for (const [attackId, change] of [
        ['bulk_notes_denied', { path: '/notes', route: 'GET /notes' }],
        ['bulk_api_notes_denied', { path: '/api/notes', route: 'GET /api/notes' }],
        ['collection_post_denied', { method: 'POST', path: '/notes', route: 'POST /notes' }],
        ['announcement_write_denied', { service: 'announcements', method: 'PUT', path: '/announcements/demo', route: 'PUT /announcements/:id' }],
        ['function_path_denied', { path: '/notes/export', route: 'GET /notes/:id' }],
      ]) {
        const reply = await decide({ ...normal, ...change });
        attempts.push(result(attackId, '기본 판정기에서 목록·공지 쓰기·기능 경로 거부',
          `기본 decide 가상 요청: ${reply.decision === 'deny' ? '통과' : '실패'} · ${reply.decision}`));
      }
      const app = new URL(config.publicAppUrl);
      if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/') {
        throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
      }
      attempts.push(...await runStepThreeChecks(config, app));
    }
    if ([9, 10, 11, 12].includes(config.step)) {
      const { detect } = await import('./detect.mjs');
      const { checkDetection } = await import('../scripts/detect-test.mjs');
      const detectionChecks = await checkDetection(detect);
      for (const [index, check] of detectionChecks.slice(0, config.step >= 11 ? 4 : 6).entries()) {
        attempts.push(result(`detection_fixture_${index + 1}`, check.name,
          config.step === 12 ? 'not_run' : `공식 연습 사건: ${check.passed ? '통과' : '실패'} · ${check.name}`));
      }
      const app = new URL(config.publicAppUrl);
      if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/') {
        throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
      }
      const publicChecks = await runStepThreeChecks(config, app);
      if (config.step >= 10) {
        attempts.push(...publicChecks.filter(check => check.attackId !== 'security_nosniff'));
        if (config.step === 12) {
          attempts.push(result('anonymous_restore_denied', '비로그인 POST 복구 요청은 자료 없이 JSON401로 거부', 'not_run'));
        } else {
          const reply = await requestPath(app, config.restoreRoute, true, 'POST');
          attempts.push(result('anonymous_restore_denied', '비로그인 POST 복구 요청은 자료 없이 JSON401로 거부',
            !reply.failed && reply.status === 401 && Object.keys(reply.data ?? {}).join(',') === 'error'
              ? '비로그인 복구 HTTP401·자료 없음 확인' : failure(reply)));
        }
      } else attempts.push(...publicChecks);
      if (config.step >= 11) {
        const manifest = await requestPath(app, '/manifest.webmanifest', true, 'GET', undefined,
          config.step === 12 ? 'app_manifest' : undefined);
        attempts.push(result('app_manifest', '공개 manifest의 앱 이름·시작 주소·standalone 설정 확인',
          manifest.ok && manifest.data?.name && manifest.data.start_url === '/' && manifest.data.display === 'standalone'
            ? 'manifest HTTP200·앱 이름·시작 주소·standalone 확인' : failure(manifest)));
        if (config.step === 11) {
          const offline = await requestPath(app, '/offline.html');
          attempts.push(result('offline_notice', '공개 오프라인 안내 HTTP200',
            offline.status === 200 && !offline.failed ? '오프라인 안내 HTTP200 확인' : failure(offline)));
        } else {
          const operations = await requestPath(app, '/api/operations', true, 'GET', undefined,
            'anonymous_operations_denied');
          attempts.push(result('anonymous_operations_denied', '무로그인 작전실 요약은 자료 없이 JSON401로 거부',
            operations.status === 401 && Object.keys(operations.data ?? {}).join(',') === 'error'
              ? '작전실 요약 HTTP401·자료 없음 확인' : failure(operations)));
        }
      }
    }
    return attempts;
  }
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step === 5) {
    const attempts=await runStepThreeChecks(config,app);
    const identity=await requestPath(app,'/aleph.json',true);
    attempts.push(result('allowed_routes','배포 식별에 허용 경로가 하나 이상',
      Array.isArray(identity.data?.allowedRoutes) && identity.data.allowedRoutes.length
        ? '허용 경로 확인' : '허용 경로 확인 실패'));
    const script=await fetch(new URL('/auth.js',app),{redirect:'error',cache:'no-store'});
    const code=await script.text();
    attempts.push(result('client_key_removed','화면 인증 코드에 실제 Supabase 키 없음',
      script.ok && !/sb_(?:publishable|secret)_|eyJ[A-Za-z0-9_-]+\./u.test(code)
        ? '화면 코드의 실제 키 없음 확인' : '화면 키 제거 확인 실패'));
    try {
      const {publishableKey}=JSON.parse(readFileSync(resolve(root,'.local/public-check-config.json'),'utf8'));
      const original=new URL(config.originalApiUrl);
      original.searchParams.set('select','note_id');
      original.searchParams.set('limit','1');
      const direct=await fetch(original,{headers:{apikey:publishableKey},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await direct.json();
      attempts.push(result('direct_storage_denied','공개 키 원본 요청은 자료 없이 거부',
        [401,403].includes(direct.status) && !Array.isArray(data)
          ? `공개 키 직접 요청 HTTP ${direct.status}·자료 없음 확인` : '원본 직접 거부 확인 실패'));
    } catch { attempts.push(result('direct_storage_denied','공개 키 원본 요청은 자료 없이 거부','직접 검사 미완료')); }
    return attempts;
  }
  if ([3, 4].includes(config.step)) return runStepThreeChecks(config, app);
  if (config.step === 2) return runStepTwoChecks(config, app);
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
