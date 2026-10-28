import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineCommit = '2e9645bfe609848443d0ba11d785834af50b83fd';
const baselineOnly = process.argv.includes('--baseline');
const phase = process.argv.find(v => v.startsWith('--phase='))?.slice(8) || (baselineOnly ? 'baseline' : 'implemented');
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('검사 단계 이름 형식 오류');
const output = process.argv.find(v => v.startsWith('--out='))?.slice(6) || path.join(os.tmpdir(), 'alekov-stage19-' + phase + '.json');
let networkCalls = 0;
let unsafeCalls = 0;
const created = [];
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this._text = ''; this.attrs = {}; this.style = {}; this.listeners = {}; this.disabled = false;
    this.dataset = new Proxy({}, {
      set: (target, key, value) => { target[key] = String(value); this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = String(value); return true; },
      get: (target, key) => target[key] ?? this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())],
    });
    this.classList = { add() {}, remove() {}, toggle() {} }; created.push(this);
  }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(n => n instanceof FakeElement ? n.textContent : String(n)).join(''); }
  append(...nodes) { for (const node of nodes) { this.children.push(node); if (node instanceof FakeElement) node.parentElement = this; } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  set innerHTML(_) { unsafeCalls++; throw new Error('innerHTML 사용'); }
  set outerHTML(_) { unsafeCalls++; throw new Error('outerHTML 사용'); }
  insertAdjacentHTML() { unsafeCalls++; throw new Error('insertAdjacentHTML 사용'); }
}
globalThis.document = { createElement: tag => new FakeElement(tag), write() { unsafeCalls++; throw new Error('document.write 사용'); } };
globalThis.Element = FakeElement;
globalThis.fetch = () => { networkCalls++; throw new Error('실제 통신은 이 검사에서 금지'); };
const api = { get() { networkCalls++; throw new Error('학생의 조회 요청'); }, post() { networkCalls++; throw new Error('학생의 집행 요청'); } };
const baselineSource = execFileSync('git', ['-C', repo, 'show', baselineCommit + ':on-client/student/extension.mjs'], { encoding: 'utf8' });
const currentSource = await readFile(path.join(repo, 'on-client/student/extension.mjs'), 'utf8');
const source = baselineOnly ? baselineSource : currentSource;
const load = async text => (await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'))).createStudentView({ api, onChange() {} });
const baseline = await load(baselineSource);
const view = await load(source);
const tests = [];
const check = (name, passed, observed = '') => tests.push({ name, passed: Boolean(passed), observed });
const text = root => root?.textContent ?? String(root ?? '');
const walk = root => root instanceof FakeElement ? [root, ...root.children.flatMap(walk)] : [];
const attr = (root, name) => walk(root).find(n => n.hasAttribute(name))?.getAttribute(name) ?? null;
const has = (root, parts) => parts.every(s => text(root).includes(s));
const render = input => {
  try { return view.renderAction(structuredClone(input)); }
  catch (error) { check('입력별 실행 오류 없음', false, error.message); return null; }
};
const at = '2026-10-28T02:00:00.000Z';
const expires = '2026-10-28T02:05:00.000Z';
const sample = (status = 'prepared', suffix = 'A') => ({
  status,
  event: { id: 'event-stage19-' + suffix, evidence: [{ id: 'evidence-' + suffix + '1', text: '모의 근거 ' + suffix }], supportedActions: ['revoke_session'] },
  actionId: 'revoke_session', target: { id: 'target-' + suffix, generation: suffix === 'A' ? 7 : 8 },
  receipt: { requestId: 'request-' + suffix, receiptId: 'receipt-' + suffix, eventId: 'event-stage19-' + suffix, actionId: 'revoke_session', status, version: suffix === 'A' ? 3 : 4, replayed: false },
  observation: status === 'succeeded' ? { observedAt: at, effectApplied: true } : null,
  message: '모의 서버 안내 ' + suffix, confirmationExpiresAt: expires,
  error: status === 'error' ? { code: 'ACTION_NETWORK_ERROR', message: '모의 네트워크 오류' } : undefined,
});
const statuses = ['idle', 'loading', 'prepared', 'executing', 'pending', 'succeeded', 'denied', 'failed', 'unknown', 'error', 'expired'];
const results = new Map(statuses.map(status => [status, render(sample(status))]));
for (const status of statuses) {
  check(status + ' 원래 상태값 표시', text(results.get(status)).includes(status), text(results.get(status)));
}
check('DOM 요소 하나 반환', results.get('prepared') instanceof FakeElement);
check('idle 아직 미실행 안내', /미실행/.test(text(results.get('idle'))), text(results.get('idle')));
check('loading 준비·조회 진행 안내', /(준비|조회)/.test(text(results.get('loading'))) && /중/.test(text(results.get('loading'))), text(results.get('loading')));
check('prepared 준비·미실행·사람 확인·기한', has(results.get('prepared'), ['준비', '미실행', expires]) && /사람|사용자|확인/.test(text(results.get('prepared'))), text(results.get('prepared')));
check('executing 서버 전달 진행 표시', /(전달|전송)/.test(text(results.get('executing'))) && /중/.test(text(results.get('executing'))), text(results.get('executing')));
check('pending 서버 접수·처리 진행 표시', /(접수|처리)/.test(text(results.get('pending'))) && /중/.test(text(results.get('pending'))), text(results.get('pending')));
for (const status of ['executing', 'pending']) {
  check(status + ' 효과 확인으로 표시하지 않음', !/효과 확인\s*\(succeeded\)/.test(text(results.get(status))) && !text(results.get(status)).includes('effectApplied: true'), text(results.get(status)));
}
const success = results.get('succeeded');
check('실제 효과 true 성공 표시', /효과 확인\s*\(succeeded\)/.test(text(success)), text(success));
check('효과 확인 근거의 시각·true·receiptId', has(success, [at, 'effectApplied: true', 'receipt-A']), text(success));
check('denied 거절·메시지', /거절/.test(text(results.get('denied'))) && has(results.get('denied'), ['모의 서버 안내 A']), text(results.get('denied')));
check('failed 실패·메시지', /실패/.test(text(results.get('failed'))) && has(results.get('failed'), ['모의 서버 안내 A']), text(results.get('failed')));
check('unknown 결과 불명·재조회 안내', /결과 불명/.test(text(results.get('unknown'))) && /재조회/.test(text(results.get('unknown'))), text(results.get('unknown')));
check('expired 기한 지남·다시 준비', /기한/.test(text(results.get('expired'))) && /다시/.test(text(results.get('expired'))) && /준비/.test(text(results.get('expired'))), text(results.get('expired')));
check('error 안전한 코드·메시지', has(results.get('error'), ['ACTION_NETWORK_ERROR', '모의 네트워크 오류']), text(results.get('error')));
for (const effectApplied of [false, null, undefined, 'true']) {
  const input = sample('succeeded'); input.observation = effectApplied === null ? null : { observedAt: at, effectApplied };
  const node = render(input);
  check('succeeded 효과 미확인 ' + String(effectApplied) + '은 unknown', /unknown/.test(text(node)) && /결과 불명/.test(text(node)) && !/효과 확인\s*\(succeeded\)/.test(text(node)), text(node));
}
const pendingEffect = sample('pending'); pendingEffect.observation = { observedAt: at, effectApplied: true };
check('pending의 관측값만으로 succeeded 승격 금지', !/효과 확인\s*\(succeeded\)/.test(text(render(pendingEffect))));
for (const status of ['constructor', 'unlisted-state']) {
  const node = render(sample(status));
  check('목록 밖 ' + status + '은 결과 불명', /unknown/.test(text(node)) && /결과 불명/.test(text(node)), text(node));
}
const bound = results.get('prepared');
check('현재 사건·근거·조치·대상·요청·영수증·버전 값', has(bound, ['event-stage19-A', 'evidence-A1', 'revoke_session', 'target-A', 'request-A', 'receipt-A', '7', '3']), text(bound));
check('현재 사건 속성 결속', attr(bound, 'data-student-action-event') === 'event-stage19-A', attr(bound, 'data-student-action-event'));
check('현재 요청 속성 결속', attr(bound, 'data-student-action-request') === 'request-A', attr(bound, 'data-student-action-request'));
const zero = sample(); zero.target.generation = 0; zero.receipt.version = 0;
const zeroNode = render(zero);
check('generation 0 생략하지 않음', /(?:세대|generation)[^]*?0/.test(text(zeroNode)), text(zeroNode));
check('version 0 생략하지 않음', /(?:버전|version)[^]*?0/.test(text(zeroNode)), text(zeroNode));
const noIds = render({ status: 'idle', event: null, target: null, receipt: null, observation: null });
check('없는 사건·요청 속성 생성하지 않음', attr(noIds, 'data-student-action-event') === null && attr(noIds, 'data-student-action-request') === null);
check('초기화 입력에서 옛 ID·효과 없음', !has(noIds, ['event-stage19-A']) && !/효과 확인\s*\(succeeded\)/.test(text(noIds)), text(noIds));
const html = sample('failed'); html.message = '<b>모의 안내</b>';
check('문자열을 HTML로 해석하지 않고 표시', text(render(html)).includes('<b>모의 안내</b>'));
const slot = new FakeElement('div');
slot.replaceChildren(render(sample('succeeded', 'A')));
slot.replaceChildren(render(sample('prepared', 'B')));
check('새 대상 B에 이전 A 대상·요청·결과 잔존 없음', has(slot, ['event-stage19-B', 'target-B', 'request-B']) && !/target-A|request-A|receipt-A/.test(text(slot)) && !/효과 확인\s*\(succeeded\)/.test(text(slot)), text(slot));
slot.replaceChildren(noIds);
check('초기화 후 이전 대상·요청·결과·속성 제거', !/target-B|request-B|receipt-B/.test(text(slot)) && attr(slot, 'data-student-action-event') === null && attr(slot, 'data-student-action-request') === null);
check('학생 조치 UI 버튼 없음', !created.some(node => node.tagName === 'BUTTON'));
check('HTML 삽입 0회', unsafeCalls === 0, unsafeCalls);
check('조회·AI·집행 요청 0회', networkCalls === 0, networkCalls);
const normalize = value => value.replace(/\r\n/g, '\n');
for (const fn of ['renderIdentity', 'renderDecision', 'renderEvents', 'renderStatus', 'renderAiConnection', 'renderExplanation']) {
  check(fn + ' 원문 보존', normalize(view[fn].toString()) === normalize(baseline[fn].toString()));
}
check('renderAction 밖 전체 원문 보존', normalize(source.replace(view.renderAction.toString(), 'STAGE19_RENDER_ACTION')) === normalize(baselineSource.replace(baseline.renderAction.toString(), 'STAGE19_RENDER_ACTION')));
check('renderAction 기준선 대비 실제 변경', normalize(view.renderAction.toString()) !== normalize(baseline.renderAction.toString()));
const report = { type: '19단계 독립 모의 DOM 검사. 실제 조치·계정·연동 시스템·공식 판정 검사가 아닙니다.', checkedAt: new Date().toISOString(), baselineCommit, baselineOnly, phase, sourceSha256: createHash('sha256').update(source).digest('hex'), passed: tests.filter(t => t.passed).length, failed: tests.filter(t => !t.passed).length, total: tests.length, networkCalls, unsafeCalls, tests };
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'tests')), output, failures: tests.filter(t => !t.passed).map(({ name, observed }) => ({ name, observed })) }, null, 2));
process.exitCode = report.failed ? 1 : 0;
