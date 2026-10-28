import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineCommit = 'ac8bda0387c767f4d62d0ebb1bfae14fc6e8d993';
const baselineOnly = process.argv.includes('--baseline');
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || (baselineOnly ? 'baseline' : 'implemented');
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('검사 단계 이름 형식 오류');
const output = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || path.join(os.tmpdir(), 'alekov-stage18-' + phase + '.json');
let unsafeCalls = 0;
let networkCalls = 0;
const created = [];
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = []; this._text = ''; this.attrs = {}; this.style = {}; this.listeners = {}; this.disabled = false;
    this.dataset = new Proxy({}, {
      set: (target, key, value) => { target[key] = String(value); this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = String(value); return true; },
      get: (target, key) => target[key] ?? this.attrs['data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())],
    });
    this.classList = { add() {}, remove() {}, toggle() {} };
    created.push(this);
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
  addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); }
  set innerHTML(_) { unsafeCalls++; throw new Error('innerHTML 사용'); }
  set outerHTML(_) { unsafeCalls++; throw new Error('outerHTML 사용'); }
  insertAdjacentHTML() { unsafeCalls++; throw new Error('insertAdjacentHTML 사용'); }
}
globalThis.document = { createElement: tag => new FakeElement(tag), write() { unsafeCalls++; throw new Error('document.write 사용'); } };
globalThis.Element = FakeElement;
globalThis.fetch = () => { networkCalls++; throw new Error('실제 통신은 이 검사에서 금지'); };
const api = { get() { networkCalls++; throw new Error('학생의 추가 조회'); }, post() { networkCalls++; throw new Error('학생의 조치 요청'); } };
const baselineSource = execFileSync('git', ['-C', repo, 'show', baselineCommit + ':on-client/student/extension.mjs'], { encoding: 'utf8' });
const currentSource = await readFile(path.join(repo, 'on-client/student/extension.mjs'), 'utf8');
const source = baselineOnly ? baselineSource : currentSource;
const importView = async text => (await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'))).createStudentView({ api, onChange() {} });
const baseline = await importView(baselineSource);
const view = await importView(source);
const tests = [];
const check = (name, passed, observed = '') => tests.push({ name, passed: Boolean(passed), observed });
const text = root => root?.textContent ?? String(root ?? '');
const walk = root => root instanceof FakeElement ? [root, ...root.children.flatMap(walk)] : [];
const marked = root => walk(root).some(n => n.hasAttribute('data-student-explanation-event'));
const has = (root, parts) => parts.every(part => text(root).includes(part));
const render = input => {
  try { return view.renderExplanation(structuredClone(input)); }
  catch (error) { check('입력별 실행 오류 없음', false, error.message); return null; }
};
const at = '2026-10-28T01:40:00.000Z';
const eventA = {
  id: 'event-stage18-A', kind: 'xdr', at, appId: 'library', summary: '가상 사건 A',
  evidence: [{ id: 'evidence-A1', text: '가상 근거 A 첫 문장' }, { id: 'evidence-A2', text: '가상 근거 A 두 번째 문장' }],
  rules: [{ id: 'rule-A1', text: '가상 규칙 A 원문' }],
  state: { access: 'unknown', session: 'active', device: 'unknown' }, supportedActions: [],
};
const eventB = {
  ...eventA, id: 'event-stage18-B', appId: 'repository', summary: '가상 사건 B',
  evidence: [{ id: 'evidence-B1', text: '가상 근거 B 문장' }],
  rules: [{ id: 'rule-B1', text: '가상 규칙 B 원문' }],
  state: { access: 'denied', session: 'unknown', device: 'compliant' },
};
const inputFor = (event, overrides = {}) => ({
  event, checkedAt: at,
  explanation: { status: 'ok', mode: 'demo', data: {
    summary: '<b>참고 요약 ' + event.id + '</b>',
    evidenceIds: event.evidence.map(item => item.id), proposals: [], requiresHumanConfirmation: true, executed: false,
    ...overrides,
  } },
});
for (const event of [eventA, eventB]) {
  const root = render(inputFor(event));
  check(event.id + ' DOM 반환', root instanceof FakeElement);
  check(event.id + ' 성공 속성과 현재 사건 ID', root?.getAttribute('data-student-explanation-event') === event.id && has(root, [event.id]));
  check(event.id + ' 참고용 제목과 요약 표시', walk(root).some(n => /^H[1-6]$/.test(n.tagName) && /참고/.test(text(n))) && has(root, ['<b>참고 요약 ' + event.id + '</b>']), text(root));
  for (const e of event.evidence) check(event.id + ' 근거 ID·원문 결속 ' + e.id, has(root, [e.id, e.text]), text(root));
  for (const r of event.rules) check(event.id + ' 규칙 ID·원문 ' + r.id, has(root, [r.id, r.text]), text(root));
  check(event.id + ' 미지원으로 빈 제안 이유', /지원.*조치.*없|지원.*않.*조치|조치.*지원.*않/.test(text(root)) && /제안/.test(text(root)), text(root));
}
const unknowns = render(inputFor({ ...eventA, state: { access: 'unknown', session: 'unknown', device: 'unknown' } }));
for (const label of ['접속', '세션', '기기']) {
  check(label + ' unknown 별도 표시', new RegExp(label + '[^\\n]*확인 불가\\s*\\(unknown\\)').test(text(unknowns)), text(unknowns));
}
const known = render(inputFor({ ...eventA, state: { access: 'allowed', session: 'active', device: 'compliant' } }));
check('unknown 목록이 없을 때 없음 안내', /없음|없습니다/.test(text(known)), text(known));
const proposals = render(inputFor({ ...eventA, supportedActions: ['revoke_session'] }, {
  proposals: [{ action: 'revoke_session', evidenceIds: ['evidence-A1'], reason: '가상 제안의 판단 이유' }],
}));
check('제안 action·reason 표시', has(proposals, ['revoke_session', '가상 제안의 판단 이유']), text(proposals));
check('제안 사람 확인과 미실행', /사람|사용자|본인/.test(text(proposals)) && /확인/.test(text(proposals)) && /실행되지|실행.*않|미실행/.test(text(proposals)), text(proposals));
const emptySupported = render(inputFor({ ...eventA, supportedActions: ['revoke_session'] }));
check('지원 조치가 있어도 제안이 없을 때 구분', /AI.*제안.*없|제안.*조치.*없|제안이 없/.test(text(emptySupported)), text(emptySupported));
for (const event of [eventA, null]) {
  const root = render({ event, checkedAt: at, explanation: { status: 'error', mode: 'unknown', error: { code: 'AI_INSUFFICIENT_EVIDENCE', message: '모의 근거 부족 오류' } } });
  check((event ? '선택 사건' : 'event null') + ' 오류 코드·메시지 우선 표시', has(root, ['AI_INSUFFICIENT_EVIDENCE', '모의 근거 부족 오류']), text(root));
  check((event ? '선택 사건' : 'event null') + ' 실패 및 기록 유지 안내', /실패/.test(text(root)) && /기록[^.]*그대로|기록[^.]*유지/.test(text(root)), text(root));
  check((event ? '선택 사건' : 'event null') + ' 실패 성공 속성 없음', !marked(root));
}
const missingEvidence = render(inputFor(eventA, { summary: '사용하면 안 되는 가상 요약', evidenceIds: ['not-in-event'] }));
check('없는 근거 ID 설명 거부', /근거/.test(text(missingEvidence)) && /맞지|불일치|없|쓸 수 없|사용할 수 없|확인.*불가/.test(text(missingEvidence)), text(missingEvidence));
check('없는 근거 ID 성공 속성 없음', !marked(missingEvidence));
check('없는 근거로 요약을 확정하지 않음', !text(missingEvidence).includes('사용하면 안 되는 가상 요약'), text(missingEvidence));
const executed = render(inputFor(eventA, { summary: '이미 실행했다는 가상 요약', executed: true }));
check('executed true 응답 거부 안내', /실행/.test(text(executed)) && /쓸 수 없|사용할 수 없|거부|실패|허용.*않/.test(text(executed)), text(executed));
check('executed true 성공 속성 없음', !marked(executed));
for (const status of ['idle', 'loading']) {
  const root = render({ event: eventA, checkedAt: at, explanation: { status, mode: 'demo' } });
  check(status + ' 성공 속성 없음', !marked(root));
  if (status === 'loading') check('설명 요청 중 표시', /설명.*중|불러오는 중|요청 중/.test(text(root)), text(root));
}
const noEvent = render({ event: null, checkedAt: at, explanation: { status: 'idle', mode: 'unknown' } });
check('미선택 기록 선택 안내', /보안 기록/.test(text(noEvent)) && /고르|선택/.test(text(noEvent)), text(noEvent));
check('미선택 성공 속성 없음', !marked(noEvent));
const noData = render({ event: eventA, checkedAt: at, explanation: { status: 'ok', mode: 'demo' } });
check('자료 없음 성공 속성 없음', !marked(noData));
const slot = new FakeElement('div');
slot.replaceChildren(render(inputFor(eventA)));
slot.replaceChildren(render(inputFor(eventB)));
check('다른 사건 입력 시 이전 설명·근거·속성 제거', !text(slot).includes(eventA.id) && !text(slot).includes('evidence-A1') && !walk(slot).some(n => n.getAttribute('data-student-explanation-event') === eventA.id) && has(slot, [eventB.id]), text(slot));
slot.replaceChildren(render({ event: eventB, checkedAt: at, explanation: { status: 'error', mode: 'unknown', error: { code: 'AI_TIMEOUT', message: '모의 시간 초과' } } }));
check('성공→실패 과거 설명·성공 속성 제거', !text(slot).includes('<b>참고 요약') && !marked(slot), text(slot));
slot.replaceChildren(render({ event: null, checkedAt: null, explanation: { status: 'idle', mode: 'unknown' } }));
check('다시 불러온 미선택 상태 과거 설명 제거', !text(slot).includes(eventB.id) && !marked(slot), text(slot));
check('학생 설명 UI 실행 버튼 없음', !created.some(n => n.tagName === 'BUTTON'));
check('HTML 문자열을 요소로 해석하지 않음', !created.some(n => ['IMG', 'SCRIPT', 'B'].includes(n.tagName)));
check('HTML 삽입 0회', unsafeCalls === 0, unsafeCalls);
check('추가 조회·AI·조치 통신 0회', networkCalls === 0, networkCalls);
const normalize = s => s.replace(/\r\n/g, '\n');
for (const fn of ['renderIdentity', 'renderDecision', 'renderEvents', 'renderStatus', 'renderAiConnection', 'renderAction']) {
  check(fn + ' 원문 보존', normalize(view[fn].toString()) === normalize(baseline[fn].toString()));
}
const strip = (text, module) => normalize(text.replace(module.renderExplanation.toString(), 'STAGE18_RENDER_EXPLANATION'));
check('renderExplanation 밖 원문 전체 보존', strip(source, view) === strip(baselineSource, baseline));
check('renderExplanation 시작 틀 대비 실제 변경', normalize(view.renderExplanation.toString()) !== normalize(baseline.renderExplanation.toString()));
const report = {
  type: '18단계 독립 모의 DOM 계약 검사. 실제 계정·AI 응답·보안 사건·공식 판정 검사가 아닙니다.',
  checkedAt: new Date().toISOString(), baselineCommit, baselineOnly, phase,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  passed: tests.filter(t => t.passed).length, failed: tests.filter(t => !t.passed).length,
  total: tests.length, networkCalls, unsafeCalls, tests,
};
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'tests')), output, failures: tests.filter(t => !t.passed).map(({ name, observed }) => ({ name, observed })) }, null, 2));
process.exitCode = report.failed ? 1 : 0;
