import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// These are student self-checks, not the judge's decision.
// Never return tokens, private keys, real names, or note bodies.
const root = resolve(import.meta.dirname, '..');
const normalizeRepo = value => {
  if (typeof value !== 'string') return null;
  const match = /^https:\/\/github\.com\/([a-z0-9-]+)\/([a-z0-9._-]+)\/?$/iu.exec(value);
  return match ? `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase().replace(/\.git$/u, '')}` : null;
};
const result = (attackId, expected, observed) => ({ attackId, expected, observed });

async function requestPath(app, path, wantsJson = false) {
  try {
    const response = await fetch(new URL(path, app), {
      method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Accept: wantsJson ? 'application/json' : 'text/html' },
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

export async function runAttackChecks(config) {
  if (![1, 2].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
