import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 기존 compare-stage16.mjs의 최소 DOM 하네스를 이 읽기 전용 계약 검사에 맞게 재사용한다.
const temp = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(temp, '../..');
const filename = path.join(repo, 'on-client/student/extension.mjs');
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'after';
const baselineOnly = process.argv.includes('--baseline');
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('검사 단계 이름 형식 오류');
let unsafeCalls = 0;
let networkCalls = 0;
const created = [];
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this._text = '';
    this.attrs = {}; this.style = {}; this.listeners = {}; this.disabled = false;
    this.dataset = new Proxy({}, {
      set: (target, key, value) => { target[key] = String(value); this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = String(value); return true; },
      get: (target, key) => target[key] ?? this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())],
    });
    this.classList = { add() {}, remove() {}, toggle() {} }; created.push(this);
  }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(x => x instanceof FakeElement ? x.textContent : String(x)).join(''); }
  append(...nodes) { for (const node of nodes) { this.children.push(node); if (node instanceof FakeElement) node.parentElement = this; } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  set innerHTML(_) { unsafeCalls++; throw new Error('innerHTML 금지'); }
  set outerHTML(_) { unsafeCalls++; throw new Error('outerHTML 금지'); }
  insertAdjacentHTML() { unsafeCalls++; throw new Error('insertAdjacentHTML 금지'); }
}
globalThis.document = { createElement: tag => new FakeElement(tag), write() { unsafeCalls++; throw new Error('document.write 금지'); } };
globalThis.Element = FakeElement;
globalThis.fetch = () => { networkCalls++; throw new Error('실제 통신 금지'); };
const api = { get() { networkCalls++; throw new Error('추가 조회 금지'); } };
const normalize = value => value.replace(/\r\n/g, '\n');
const baselineCommit = 'f0ec4380f48b950e5d9723c5dd7d4935ee5fadaf';
const baselineSource = execFileSync('git', ['-C', repo, 'show', baselineCommit + ':on-client/student/extension.mjs'], { encoding: 'utf8' });
const currentSource = await readFile(filename, 'utf8');
const source = baselineOnly ? baselineSource : currentSource;
const importView = async text => (await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'))).createStudentView({ api, onChange() {} });
const baseline = await importView(baselineSource);
const view = await importView(source);
const tests = [];
const check = (name, passed, observed = '') => tests.push({ name, passed: Boolean(passed), observed });
const walk = root => root instanceof FakeElement ? [root, ...root.children.flatMap(walk)] : [];
const plain = root => root?.textContent ?? String(root ?? '');
const has = (root, parts) => parts.every(part => plain(root).includes(part));
const render = (fn, input) => {
  try { return view[fn](structuredClone(input)); }
  catch (error) { check(fn + ' 입력별 실행 오류 없음', false, error.message); return null; }
};
const at = '2026-10-26T08:17:00.000Z';
const okInput = audience => ({ status: 'ok', mode: 'demo', checkedAt: at, explanationAccepted: false, data: { transportChecked: true, audienceAuthorization: audience, modelCount: 7, checkedAt: 'WRONG_NESTED_TIME17', help: '모의 도움정보' } });
const slot = new FakeElement('div');
let root = render('renderAiConnection', { status: 'idle', mode: 'disconnected', explanationAccepted: false });
check('점검 전 DOM 반환', root instanceof FakeElement);
check('점검 전 뜻', /점검.*전|아직.*점검|점검.*않/.test(plain(root)), plain(root));
root = render('renderAiConnection', { status: 'loading', mode: 'demo', explanationAccepted: false });
check('점검 중 뜻', /점검.*중|확인.*중/.test(plain(root)), plain(root));
for (const audience of ['test', 'verified']) {
  root = render('renderAiConnection', okInput(audience));
  check(audience + ' DOM 반환', root instanceof FakeElement);
  check(audience + ' 점검 종류 뜻·원래 코드', plain(root).includes(audience) && (audience === 'test' ? /시험.*점검/.test(plain(root)) : /권한.*확인.*점검/.test(plain(root))), plain(root));
  check(audience + ' 모델 수·최상위 시각', has(root, ['7', at]) && !plain(root).includes('WRONG_NESTED_TIME17'), plain(root));
  check(audience + ' 사건 설명 미실행', /사건.*설명[^.]*아직[^.]*않|사건.*설명[^.]*실행[^.]*않|설명.*미실행/.test(plain(root)), plain(root));
}
const errorGroups = [
  ['권한 준비 중', 'ON_AI_PROVISIONING_PENDING', /준비|권한|확인.*불가/, /담당자|연결.*확인/],
  ['인증', 'WB_CLCO_AUTH_REQUIRED', /인증|계정.*연결/, /확인/],
  ['접근 제한', 'WB_CLCO_ACCESS_BLOCKED', /접근|권한/, /담당자|확인|제한|차단/],
  ['반 사용량·한도', 'WB_CLCO_COHORT_BUDGET_EXHAUSTED', /사용량|한도/, /담당자|확인/],
  ['이용 시간', 'WB_CLCO_SESSION_CLOSED', /이용.*시간|시간.*이용|이용.*종료|운영.*시간/, /확인/],
  ['요청 제한', 'WB_CLCO_RATE_LIMITED', /제한|잠시|나중|요청.*많/, /직접|수동|누르/],
  ['시간 초과·네트워크', 'WB_CLCO_TIMEOUT', /시간.*초과|시간초과|네트워크|지연/, /직접|수동|누르/],
  ['취소', 'CANCELLED', /취소/, /이전.*현재.*아|이전.*유효.*아|이전.*결과.*사용.*않|이전.*결과.*대체.*않|이전.*결과.*아/],
  ['모델 없음', 'MODEL_NOT_CONFIGURED', /모델/, /허용|설정|담당자/],
];
for (let i = 0; i < errorGroups.length; i++) {
  const [group, code, meaning, guidance] = errorGroups[i];
  const message = '모의오류_' + i + '_17';
  root = render('renderAiConnection', { status: 'error', mode: 'unknown', error: { code, message }, checkedAt: at, explanationAccepted: false });
  check(group + ' 안전 코드·메시지', has(root, [code, message]), plain(root));
  check(group + ' 원인별 안내', meaning.test(plain(root)) && guidance.test(plain(root)), plain(root));
}
slot.replaceChildren(render('renderAiConnection', { status: 'error', mode: 'unknown', error: { code: 'WB_CLCO_AUTH_REQUIRED', message: 'OLD_ERROR17' }, checkedAt: at, explanationAccepted: false }));
slot.replaceChildren(render('renderAiConnection', okInput('test')));
check('오류→성공 이전 오류 제거', has(slot, ['test', at]) && !has(slot, ['OLD_ERROR17']) && !has(slot, ['WB_CLCO_AUTH_REQUIRED']), plain(slot));
slot.replaceChildren(render('renderAiConnection', { status: 'idle', mode: 'unknown', explanationAccepted: false }));
check('성공→idle 이전 점검 결과 제거', !plain(slot).includes(at) && !plain(slot).includes('WRONG_NESTED_TIME17') && /점검.*전|아직.*점검|점검.*않/.test(plain(slot)), plain(slot));
root = render('renderAiConnection', { status: 'error', mode: 'unknown', error: { code: 'AI_REQUEST_UNVERIFIED', message: '<img src=x onerror=alert(1)>오류17' }, checkedAt: at, explanationAccepted: false });
check('오류 HTML 문자열 문자 보존', plain(root).includes('<img src=x onerror=alert(1)>오류17'), plain(root));
const eventA = { id: 'EVENT17_A', kind: 'xdr', at, summary: '기록17A', evidence: [], rules: [], state: { access: 'unknown', session: 'unknown', device: 'unknown' }, supportedActions: [] };
const explanationInput = event => ({ event, checkedAt: at, explanation: { status: 'ok', mode: 'demo', data: { summary: '<b>사건요약_' + event.id + '</b>' } } });
for (const event of [eventA, { ...eventA, id: 'EVENT17_B' }]) {
  root = render('renderExplanation', explanationInput(event));
  check(event.id + ' 설명 DOM 반환', root instanceof FakeElement);
  check(event.id + ' 바깥 성공 속성', root instanceof FakeElement && root.getAttribute('data-student-explanation-event') === event.id, root?.attrs ?? null);
  check(event.id + ' 사건 ID·요약 문자 표시', has(root, [event.id, '<b>사건요약_' + event.id + '</b>']), plain(root));
}
slot.replaceChildren(render('renderExplanation', explanationInput(eventA)));
slot.replaceChildren(render('renderExplanation', explanationInput({ ...eventA, id: 'EVENT17_B' })));
check('선택 사건 변경 시 이전 ID·요약 제거', !plain(slot).includes('EVENT17_A') && plain(slot).includes('EVENT17_B') && !walk(slot).some(n => n.getAttribute('data-student-explanation-event') === 'EVENT17_A'), plain(slot));
root = render('renderExplanation', { event: eventA, checkedAt: at, explanation: { status: 'error', mode: 'unknown', error: { code: 'WB_CLCO_TIMEOUT', message: 'EXPLANATION_ERROR17' } } });
check('설명 실패 코드·메시지', has(root, ['WB_CLCO_TIMEOUT', 'EXPLANATION_ERROR17']), plain(root));
check('설명 실패 기존 기록 유지 안내', /기록[^.]*그대로|기록[^.]*유지|기록[^.]*변경.*않/.test(plain(root)), plain(root));
check('설명 실패 성공 속성 없음', !walk(root).some(n => n.hasAttribute('data-student-explanation-event')));
for (const status of ['idle', 'loading']) {
  root = render('renderExplanation', { event: null, explanation: { status, mode: 'unknown' }, checkedAt: null });
  check('미선택 ' + status + ' DOM·성공 속성 없음', root instanceof FakeElement && !walk(root).some(n => n.hasAttribute('data-student-explanation-event')), plain(root));
}
check('HTML 입력을 요소로 만들지 않음', !created.some(n => ['IMG', 'SCRIPT', 'B'].includes(n.tagName)));
check('금지 HTML 삽입 0회', unsafeCalls === 0, unsafeCalls);
check('fetch·학생 추가 조회 0회', networkCalls === 0, networkCalls);
for (const fn of ['renderIdentity', 'renderDecision', 'renderEvents', 'renderStatus']) {
  check(fn + ' HEAD 원문 보존', normalize(view[fn].toString()) === normalize(baseline[fn].toString()));
}
const strip17 = (text, module) => {
  for (const name of ['renderAiConnection', 'renderExplanation']) {
    const functionText = module[name].toString();
    if (!text.includes(functionText)) throw new Error(name + ' 원문 경계를 찾지 못했습니다');
    text = text.replace(functionText, 'STAGE17_FUNCTION_' + name);
  }
  return normalize(text);
};
check('두 17함수 밖 전체 텍스트 HEAD 보존', strip17(source, view) === strip17(baselineSource, baseline));
check('17 학생 함수 원문 실제 변경', ['renderAiConnection', 'renderExplanation'].every(name => normalize(view[name].toString()) !== normalize(baseline[name].toString())));
const report = {
  type: '17단계 최소 모의 DOM 계약 검사. 실API·브라우저·계정 승인·공식 판정 검사가 아닙니다.',
  checkedAt: new Date().toISOString(), phase, baselineOnly, filename: 'on-client/student/extension.mjs', baselineCommit,
  command: ['node', 'verification/stage17/check.mjs', ...process.argv.slice(2)],
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  baselineSha256: createHash('sha256').update(baselineSource).digest('hex'),
  preservedReadOnly: true, networkCalls, unsafeCalls,
  passed: tests.filter(t => t.passed).length, failed: tests.filter(t => !t.passed).length, total: tests.length, tests,
};
const resultFile = path.join(temp, 'stage17-contract-results-' + phase + '.json');
await writeFile(resultFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ type: report.type, phase, baselineOnly, baselineCommit, sourceSha256: report.sourceSha256, passed: report.passed, failed: report.failed, total: report.total, networkCalls, unsafeCalls, resultFile, failures: tests.filter(t => !t.passed).map(t => ({ name: t.name, observed: t.observed })) }, null, 2));
process.exitCode = report.failed > 0 ? 1 : 0;
