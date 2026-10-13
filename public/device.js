import { client } from './auth.js';
import { canonicalBody, canonicalProtectedPath, canonicalRequest, publicJwkCanonical } from './device-protocol.js';

const statusBox = document.querySelector('#device-status');
const fingerprintBox = document.querySelector('#device-fingerprint');
const requestButton = document.querySelector('#device-request');
const refreshButton = document.querySelector('#device-refresh');
const checkButton = document.querySelector('#device-check');
const checkStatus = document.querySelector('#device-check-status');
const encoder = new TextEncoder();
let session;
let keyPair;
let publicKey;
let fingerprint;
let deviceId;
let approval = 'unknown';
let revision = 0;
let requesting = false;
let statusError = '';
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
const digest = async text => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
export const isDeviceApproved = () => !!session?.user && !!keyPair && approval === 'approved';
function render() {
  requestButton.hidden = !session?.user;
  requestButton.disabled = requesting || approval === 'approved';
  refreshButton.hidden = !session?.user || !deviceId;
  checkButton.hidden = !isDeviceApproved();
  statusBox.textContent = !session?.user ? '기기 승인: 먼저 로그인해 주세요.'
    : approval === 'approved' ? '기기 승인: 서버에서 등록 기기로 확인했습니다.'
    : approval === 'pending' ? '기기 승인: 검토 대기 중입니다. 보호 자료는 열리지 않습니다.'
    : ['denied', 'revoked'].includes(approval) ? '기기 승인: 승인되지 않았습니다. 보호 자료는 열리지 않습니다.'
    : '기기 승인: 서버 확인 전입니다. 기기 승인을 요청해 주세요.';
  fingerprintBox.textContent = fingerprint ? `이 기기 확인 지문: ${fingerprint}` : '';
  if (statusError) statusBox.textContent = statusError;
  document.dispatchEvent(new CustomEvent('device-approval-changed'));
}
async function prepareKey() {
  if (keyPair) return;
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicKey = { crv: exported.crv, kty: exported.kty, x: exported.x, y: exported.y };
  fingerprint = await digest(publicJwkCanonical(publicKey));
  deviceId = fingerprint.slice(0, 16);
}
async function approvalRequest(path, method = 'GET', body) {
  const actor = session?.user?.id;
  const token = session?.access_token;
  if (!actor || !token) throw new Error('먼저 로그인해 주세요.');
  const response = await fetch(path, { method, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (session?.user?.id !== actor) throw new Error('로그인 상태가 바뀌었습니다. 다시 확인해 주세요.');
  if (!response.ok) throw new Error(response.status === 401 ? '다시 로그인해 주세요.' : '기기 상태를 확인하지 못했습니다.');
  if (data.deviceId !== deviceId || data.fingerprint !== fingerprint
      || !['pending', 'approved', 'denied', 'revoked'].includes(data.status)) throw new Error('기기 확인 결과가 맞지 않습니다.');
  return data;
}
async function refreshApproval() {
  if (!session?.user || !deviceId) return;
  const current = ++revision;
  statusError = '';
  try {
    const data = await approvalRequest(`/api/device/status?id=${encodeURIComponent(deviceId)}`);
    if (current !== revision) return;
    approval = data.status; render();
  } catch (error) {
    if (current !== revision) return;
    approval = 'unknown'; statusError = error.message; render();
  }
}
requestButton.addEventListener('click', async () => {
  const actor = session?.user?.id;
  if (!actor || requesting) return;
  requesting = true; statusError = ''; render();
  try {
    await prepareKey();
    if (session?.user?.id !== actor) return;
    const data = await approvalRequest('/api/device/request', 'POST', { publicKey });
    approval = data.status;
  } catch { approval = 'unknown'; statusError = '기기 승인을 요청하지 못했습니다. 로그인과 연결 상태를 확인해 주세요.'; }
  finally { requesting = false; render(); }
});
refreshButton.addEventListener('click', refreshApproval);
async function signedOptions(path, method = 'GET', body) {
  if (!isDeviceApproved()) throw new Error('서버의 기기 승인이 필요합니다.');
  const actor = session.user.id;
  const token = session.access_token;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const normalizedPath = canonicalProtectedPath(path);
  const encodedBody = canonicalBody(body);
  const message = canonicalRequest({ userId: actor, deviceId, method, path: normalizedPath,
    timestamp, nonce, bodyHash: await digest(encodedBody) });
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, encoder.encode(message));
  if (session?.user?.id !== actor || !isDeviceApproved()) throw new Error('기기와 로그인 상태를 다시 확인해 주세요.');
  return { method, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId, 'X-Device-Time': timestamp,
      'X-Device-Nonce': nonce, 'X-Device-Signature': base64url(new Uint8Array(signature)),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: encodedBody } : {}) };
}
export async function protectedFetch(path, method = 'GET', body) {
  return fetch(path, await signedOptions(path, method, body));
}
checkButton.addEventListener('click', async () => {
  if (!isDeviceApproved()) return;
  const actor = session.user.id;
  checkButton.disabled = true; checkStatus.textContent = '보호 요청을 확인하고 있습니다.';
  try {
    const unsigned = await fetch('/api/notes', { credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${session.access_token}` } });
    const trialPath = '/api/notes/00000000-0000-4000-8000-000000000001';
    const changedPath = await fetch(trialPath, await signedOptions('/api/notes'));
    const originalBody = { title: '가상 서명 검사', body: '가상 서명 내용' };
    const changedBodyOptions = await signedOptions(trialPath, 'PUT', originalBody);
    changedBodyOptions.body = canonicalBody({ ...originalBody, body: '변경된 가상 내용' });
    const changedBody = await fetch(trialPath, changedBodyOptions);
    const replayOptions = await signedOptions('/api/notes');
    const normal = await fetch('/api/notes', replayOptions);
    const replay = await fetch('/api/notes', replayOptions);
    if (session?.user?.id !== actor) throw new Error('로그인 상태가 바뀌었습니다.');
    const results = [normal.status, unsigned.status, changedPath.status, changedBody.status, replay.status];
    const passed = results.every((status, index) => status === (index ? 403 : 200));
    checkStatus.textContent = `${passed ? '확인 통과' : '확인 실패'}: 정상 ${results[0]}, 서명 없음 ${results[1]}, 경로 변경 ${results[2]}, 본문 변경 ${results[3]}, 재전송 ${results[4]}. 시험 요청으로 기존 메모를 수정하지 않았습니다.`;
  } catch { checkStatus.textContent = '보호 요청을 확인하지 못했습니다. 로그인과 연결 상태를 다시 확인해 주세요.'; }
  finally { checkButton.disabled = false; }
});
function changeSession(next) {
  checkStatus.textContent = '';
  session = next; ++revision; approval = 'unknown'; statusError = ''; render();
  if (next?.user && deviceId) void refreshApproval();
}
client.auth.onAuthStateChange((_event, next) => changeSession(next));
const initial = await client.auth.getSession();
changeSession(initial.data.session);
