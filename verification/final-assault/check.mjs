// 합성 입력과 모의 DOM만 사용합니다. 실제 PC 조회·외부 통신·보안 조치는 실행하지 않습니다.
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineCommit = '687120e6f97cc61d0088487491d8bdae283c67d9';
const output = process.argv.find(arg => arg.startsWith('--out='))?.slice(6)
  || path.join(os.tmpdir(), 'narachan-final-assault-check.json');
const tests = [], eventErrors = [];
let unsafeCalls = 0, networkCalls = 0, automaticSchedules = 0, onChangeCalls = 0;

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this._text = ''; this.attrs = {}; this.style = {}; this.listeners = {};
    this.disabled = false; this.hidden = false; this.value = '';
    this.dataset = new Proxy({}, {
      set: (_, key, value) => { this.setAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value); return true; },
      get: (_, key) => this.getAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())),
    });
    this.classList = {
      add: (...names) => { this.className = [...new Set((this.className || '').split(/\s+/).filter(Boolean).concat(names))].join(' '); },
      remove: (...names) => { this.className = (this.className || '').split(/\s+/).filter(n => !names.includes(n)).join(' '); },
      contains: name => (this.className || '').split(/\s+/).includes(name),
    };
  }
  set textContent(value) { this.replaceChildren(); this._text = String(value ?? ''); }
  get textContent() { return this._text + this.children.map(node => node instanceof FakeElement ? node.textContent : String(node)).join(''); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) {
    if (node instanceof FakeElement) { node.remove(); node.parentNode = this; }
    this.children.push(node); return node;
  }
  replaceChildren(...nodes) { for (const node of this.children) if (node instanceof FakeElement) node.parentNode = null; this.children = []; this._text = ''; this.append(...nodes); }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; } }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
  removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter(value => value !== listener); }
  contains(node) { return walk(this).includes(node); }
  querySelectorAll(selector) { return walk(this).slice(1).filter(node => matches(node, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
  set innerHTML(_) { unsafeCalls++; throw Error('금지된 HTML 삽입'); }
  set outerHTML(_) { unsafeCalls++; throw Error('금지된 HTML 삽입'); }
  insertAdjacentHTML() { unsafeCalls++; throw Error('금지된 HTML 삽입'); }
}
const walk = root => root instanceof FakeElement ? [root, ...root.children.flatMap(walk)] : [];
const matches = (node, selector) => selector.split(',').some(raw => {
  const value = raw.trim();
  if (value.startsWith('#')) return node.id === value.slice(1) || node.getAttribute('id') === value.slice(1);
  if (value.startsWith('.')) return node.classList.contains(value.slice(1));
  const attr = value.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if (attr) return attr[2] === undefined ? node.hasAttribute(attr[1]) : node.getAttribute(attr[1]) === attr[2];
  return node.tagName === value.toUpperCase();
});
globalThis.document = {createElement: tag => new FakeElement(tag), createElementNS: (_, tag) => new FakeElement(tag), activeElement: null, hidden: false};
globalThis.Element = FakeElement;
globalThis.HTMLElement = FakeElement;
globalThis.Node = FakeElement;
globalThis.fetch = () => { networkCalls++; throw Error('실제 통신 금지'); };
globalThis.setInterval = () => { automaticSchedules++; return -1; };
globalThis.clearInterval = () => {};

const check = (name, passed, observed = '') => tests.push({name, passed: Boolean(passed), observed});
const text = node => node?.textContent || '';
const find = (root, attribute) => walk(root).find(node => node.hasAttribute(attribute));
const button = (root, label) => walk(root).find(node => node.tagName === 'BUTTON' && (node.getAttribute('aria-label') || text(node)) === label);
const click = node => {
  if (!node || node.disabled) return false;
  for (const listener of node.listeners.click || []) {
    try { const result = listener({target: node, currentTarget: node, preventDefault(){}}); if (result?.catch) result.catch(error => eventErrors.push(error.message)); }
    catch (error) { eventErrors.push(error.message); }
  }
  return true;
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
const baselineSource = execFileSync('git', ['-C', repo, 'show', baselineCommit + ':on-client/student/extension.mjs'], {encoding: 'utf8'});
const source = await readFile(path.join(repo, 'on-client/student/extension.mjs'), 'utf8');
const load = async value => (await import('data:text/javascript;base64,' + Buffer.from(value).toString('base64'))).createStudentView;
const baselineFactory = await load(baselineSource), factory = await load(source);
const pending = [], calls = [];
const api = {get(url) { calls.push(url); return new Promise(resolve => pending.push({url, resolve})); }};
const view = factory({api, onChange(){ onChangeCalls++; }});
const baseline = baselineFactory({api: {get(){throw Error('기준 함수의 예기치 않은 요청');}}, onChange(){}});
// 실제로 실행하는 시점의 신선도 검사를 통과할 합성 시각입니다. 실측 시각으로 기록하지 않습니다.
const at = new Date(Date.now() - 30000).toISOString();
const statusInput = {mode: 'disconnected', devices: {status:'ok',mode:'demo',data:[]}, sessions: {status:'ok',mode:'demo',data:[]}, notifications: [], diagnostics: {status:'idle',mode:'demo'}};
const statusRoot = view.renderStatus(structuredClone(statusInput));
const panel = find(statusRoot, 'data-student-pc-dashboard');
check('PC 패널이 학생 상태 영역의 DOM 요소로 존재', panel instanceof FakeElement);
check('초기 화면에서 자동 조회 없음', calls.length === 0);
check('초기 조회 전 상태와 수동 버튼 표시', panel && /조회 전|아직.*조회|확인 전/.test(text(panel)) && Boolean(button(panel, 'PC 상태 다시 조회')), text(panel));
check('초기 화면에 예제 CPU·메모리 값 채우지 않음', !/32%|58%/.test(text(panel)));

const response = (number = 1, change = {}) => ({
  ok: true,
  data: {
    schema:'aleph.on.pc-status.v1', source:'local-pc', measuredAt:new Date(Date.parse(at) + number * 1000).toISOString(),
    metrics: {
      cpu: {state:'ok',usagePercent:17.3,sampleMs:200},
      memory: {state:'ok',usedBytes:4 * 1024 ** 3,totalBytes:16 * 1024 ** 3},
      disk: {state:'ok',freeBytes:128 * 1024 ** 3,totalBytes:512 * 1024 ** 3},
      network: {state:'ok',interfaceCount:2,ipv4Count:3},
      firewall: {state:'ok',profiles:[{name:'Domain',enabled:true},{name:'Private',enabled:true},{name:'Public',enabled:false}]},
      events: {state:'ok',warningCount:3,errorCount:2,truncated:false,sampleLimit:5000,since:new Date(Date.parse(at)-86400000).toISOString()},
    }, ...change,
  }, meta: {mode:'unknown',checkedAt:null},
});
const current = () => find(panel, 'data-student-pc-current');
const history = () => find(panel, 'data-student-pc-history');
const resolveLatest = async value => { pending.at(-1)?.resolve(value); await flush(); };

if (panel) {
  click(button(panel, 'PC 상태 다시 조회'));
  check('직접 누른 조회가 정확한 제공 경로만 요청', calls.length === 1 && calls[0] === '/api/pc/status', calls);
  check('요청 중 대기 상태 표시', /조회(?:하는)?\s*중|읽는 중|불러오는 중|대기/.test(text(panel)), text(panel));
  click(button(panel, 'PC 상태 다시 조회')); await flush();
  check('진행 중 중복 클릭이 새 요청을 만들지 않음', calls.length === 1);
  await resolveLatest(response());
  check('현재 결과와 과거 이력 표시 영역 구분', current() instanceof FakeElement && history() instanceof FakeElement);
  check('mode unknown이어도 local-pc 출처를 실제 조회로 구분', /실측|실제 조회/.test(text(current())) && /local-pc|이 PC|내 PC|로컬/.test(text(current())), text(current()));
  check('CPU 수치·단위·측정 범위를 표시', /17\.3/.test(text(current())) && /%/.test(text(current())) && /200/.test(text(panel)), text(current()));
  check('메모리와 디스크 바이트를 단위와 함께 표시', /메모리/.test(text(current())) && /디스크/.test(text(current())) && /GiB|GB|바이트|bytes/i.test(text(current())), text(current()));
  check('측정 시각을 표시', /2026|12:30|03:30/.test(text(current())), text(current()));
  check('네트워크 구성 수와 인터넷 접속 보장 구분', /네트워크/.test(text(panel)) && /인터넷/.test(text(panel)) && /보장.*않|확인.*아|성공.*아|접속.*뜻.*않/.test(text(panel)), text(panel));
  check('방화벽 세 프로필과 켜짐·꺼짐 표시', ['Domain','Private','Public'].every(value => text(panel).includes(value)) && /켜짐/.test(text(panel)) && /꺼짐/.test(text(panel)), text(panel));
  check('Windows 기록의 24시간·표본 범위와 침해 판정 구분', /24/.test(text(panel)) && /5,?000/.test(text(panel)) && /침해|공격/.test(text(panel)) && /아닙|아님/.test(text(panel)), text(panel));
  check('조회 성공이 SDP 연결 성공이라고 표시하지 않음', /SDP/.test(text(statusRoot)) && !/SDP.*연결 성공/.test(text(statusRoot)), text(statusRoot));
  check('수동 조회가 과거 이력에 기록됨', /최근 수동 조회/.test(text(panel)) && /17\.3/.test(text(history())), text(history()));
  check('PC 완료가 다른 학생 영역 전체 재렌더를 호출하지 않음', onChangeCalls === 0);
  const rerendered = view.renderStatus(structuredClone(statusInput));
  check('제공 전체 재렌더 뒤 동일 PC 패널·이력 유지', find(rerendered, 'data-student-pc-dashboard') === panel && /17\.3/.test(text(history())));

  click(button(panel, 'PC 상태 다시 조회'));
  await resolveLatest({ok:false,error:{code:'NETWORK_ERROR',message:'합성 통신 오류'}});
  check('조회 실패와 수동 복구 안내', /실패|확인 불가/.test(text(current())) && /다시|재조회/.test(text(panel)), text(current()));
  check('실패 시 과거 CPU 값을 현재값으로 남기지 않음', !/17\.3/.test(text(current())), text(current()));
  check('실패 시 과거 값은 이력에서 구분해 유지', /17\.3/.test(text(history())), text(history()));
  click(button(panel, 'PC 상태 다시 조회'));
  await resolveLatest(response(2));
  check('재조회 성공 후 이전 실패 상태 제거', /17\.3/.test(text(current())) && !/NETWORK_ERROR/.test(text(current())), text(current()));

  click(button(panel, 'PC 상태 다시 조회')); const delayed = pending.at(-1);
  check('진행 중 취소 버튼 제공', Boolean(button(panel, 'PC 조회 취소')) && !button(panel, 'PC 조회 취소')?.disabled);
  click(button(panel, 'PC 조회 취소')); await flush();
  check('취소가 성공이 아닌 취소 상태로 표시', /취소/.test(text(panel)) && !/17\.3/.test(text(current())), text(current()));
  const pendingCountAfterCancel=calls.length;
  click(button(panel,'PC 상태 다시 조회')); await flush();
  check('취소 표시 뒤 원래 공유 요청이 끝나기 전 중복 전송 없음',calls.length===pendingCountAfterCancel);
  const cancelledText = text(current());
  delayed.resolve(response(3, {metrics:{...response().data.metrics,cpu:{state:'ok',usagePercent:88.8,sampleMs:200}}})); await flush();
  check('취소 후 늦은 응답을 현재값·이력에 반영하지 않음', text(current()) === cancelledText && !/88\.8/.test(text(history())));

  click(button(panel, 'PC 상태 다시 조회'));
  const zero = response(4); zero.data.metrics.cpu.usagePercent = 0; zero.data.metrics.network.interfaceCount = 0; zero.data.metrics.network.ipv4Count = 0; zero.data.metrics.events.warningCount = 0; zero.data.metrics.events.errorCount = 0;
  await resolveLatest(zero);
  check('정상 0값을 확인 불가로 바꾸지 않음', /0(?:\.0)?\s*%/.test(text(current())) && !/CPU[^\n]*확인 불가/.test(text(current())), text(current()));

  click(button(panel, 'PC 상태 다시 조회'));
  const partial = response(5); partial.data.metrics.disk={state:'unavailable',reason:'permission_denied'}; partial.data.metrics.firewall={state:'unavailable',reason:'timeout'}; partial.data.metrics.events.truncated=true;
  await resolveLatest(partial);
  check('부분 실패 항목은 확인 불가와 이유 표시', /디스크/.test(text(current())) && /확인 불가/.test(text(current())) && /권한|permission_denied/.test(text(current())), text(current()));
  check('부분 실패가 정상 CPU까지 0이나 예제로 바꾸지 않음', /17\.3/.test(text(current())), text(current()));
  check('표본 잘림을 전체 경고·오류 건수로 과장하지 않음', /잘림|일부|상한|최대/.test(text(panel)), text(panel));

  click(button(panel,'PC 상태 다시 조회'));
  const unsupported=response(6); unsupported.data.metrics.firewall={state:'unavailable',reason:'unsupported'}; unsupported.data.metrics.events={state:'unavailable',reason:'unsupported'};
  await resolveLatest(unsupported);
  check('제공 계약의 unsupported 원인을 한국어 미지원 안내로 표시', (text(current()).match(/이 운영체제에서 제공하지 않습니다\./g)||[]).length===2 && /확인 불가/.test(text(current())), text(current()));
  click(button(panel,'PC 상태 다시 조회'));
  const inheritedNames=response(7); inheritedNames.data.metrics.disk={state:'unavailable',reason:'toString'}; inheritedNames.data.metrics.firewall={state:'unavailable',reason:'constructor'}; inheritedNames.data.metrics.events={state:'unavailable',reason:'__proto__'};
  await resolveLatest(inheritedNames);
  check('알 수 없는 원인 이름을 함수·객체로 출력하지 않고 확인 불가로 처리', (text(current()).match(/응답 형식이나 값을 확인할 수 없습니다\./g)||[]).length===3 && !/function\b|\[object Object\]|\[native code\]/.test(text(current())), text(current()));
  view.renderStatus({...structuredClone(statusInput),mode:'constructor'});
  check('알 수 없는 SDP mode가 객체 프로토타입 값을 노출하지 않음', /SDP 연결 상태: 확인 불가/.test(text(panel)) && !/function\b|\[object Object\]|\[native code\]/.test(text(panel)), text(panel));
  view.renderStatus(structuredClone(statusInput));

  for (const [name, value] of [
    ['다른 schema', response(6,{schema:'fixture.invalid'})],
    ['예제 출처', response(7,{source:'demo'})],
    ['잘못된 시각', response(8,{measuredAt:'fixture-not-a-time'})],
    ['5분 넘은 시각', response(8,{measuredAt:new Date(Date.now()-600000).toISOString()})],
    ['30초 넘은 미래 시각', response(8,{measuredAt:new Date(Date.now()+60000).toISOString()})],
  ]) {
    click(button(panel, 'PC 상태 다시 조회')); await resolveLatest(value);
    check(name+'를 실제 현재 측정 성공으로 채우지 않음', /확인 불가|형식|계약|불일치|실패/.test(text(current())) && !/17\.3/.test(text(current())), text(current()));
  }
  click(button(panel,'PC 상태 다시 조회'));
  const wrongSample=response(9); wrongSample.data.metrics.cpu.sampleMs=100; wrongSample.data.metrics.events.since=new Date(Date.parse(at)-3600000).toISOString();
  await resolveLatest(wrongSample);
  check('공식 CPU 표본 200ms 밖의 값을 정상 CPU로 표시하지 않음', !/17\.3/.test(text(current())) && /확인 불가/.test(text(current())), text(current()));
  check('24시간 밖의 이벤트 범위를 정상 집계로 표시하지 않음', !/경고 3건/.test(text(current())) && /확인 불가/.test(text(current())), text(current()));
  click(button(panel,'PC 상태 다시 조회'));
  const unsafeReason='합성_숨김표식_<b>원문 오류</b>';
  await resolveLatest({ok:false,error:{code:unsafeReason,message:unsafeReason}});
  check('승인되지 않은 오류 코드·원문 메시지를 그대로 출력하지 않음',!text(panel).includes(unsafeReason)&&/실패|확인 불가/.test(text(panel)),text(current()));
  for (let number=10; number<22; number++) {
    click(button(panel,'PC 상태 다시 조회')); const value=response(number); value.data.metrics.cpu.usagePercent=number + 0.1; await resolveLatest(value);
  }
  const historyText=text(history());
  check('최근 이력은 최신 10개까지만 메모리에 표시', /21\.1/.test(historyText) && /12\.1/.test(historyText) && !/10\.1/.test(historyText) && !/11\.1/.test(historyText), historyText);
}

// 기준 함수와 같은 합성 입력을 대조합니다. PC 확장 외의 기존 상태 표시는 바뀌지 않아야 합니다.
const normalizeSource = value => value.replace(/\r\n/g,'\n');
for (const name of ['renderIdentity','renderDecision','renderEvents','renderVulnerabilities','renderAiConnection','renderExplanation','renderAction']) {
  check(name+' 기존 원문 보존', typeof view[name] === 'function' && normalizeSource(view[name].toString()) === normalizeSource(baseline[name].toString()));
}
const event = {id:'fixture-event',at,kind:'access',appId:'library',summary:'합성 접속 기록',evidence:[{id:'fixture-evidence',text:'합성 근거'}],rules:[{id:'fixture-rule',text:'합성 규칙'}],state:{access:'denied',session:'active',device:'unknown'},supportedActions:[]};
const ok=data=>({status:'ok',mode:'demo',data});
const regressionInputs = {
  renderIdentity:[{me:ok({id:'fixture-user',name:'합성 사용자'}),devices:ok([]),sessions:ok([])},{me:{status:'error',mode:'disconnected',error:{code:'ENGINE_NOT_CONNECTED',message:'합성 미연결'}},devices:ok([]),sessions:ok([])}],
  renderDecision:[{status:'idle',mode:'demo'},{status:'ok',mode:'demo',appId:'library',data:{appId:'library',decision:'deny',reason:'합성 판정',checkedAt:at}}],
  renderEvents:[ok([event]),ok([])],
  renderStatus:[statusInput,{...statusInput,devices:{status:'error',mode:'demo',error:{code:'NETWORK_ERROR',message:'합성 조회 실패'}}}],
  renderVulnerabilities:[{status:'idle',mode:'demo'},ok({status:'not_configured',checkedAt:at,packages:[]})],
  renderAiConnection:[{status:'idle',mode:'demo'},{status:'ok',mode:'demo',data:{transportChecked:true,audienceAuthorization:'verified',modelCount:1},checkedAt:at,explanationAccepted:false}],
  renderExplanation:[{event:null,explanation:{status:'idle'}},{event,explanation:{status:'ok',mode:'demo',data:{summary:'합성 설명',evidenceIds:['fixture-evidence'],proposals:[]}},checkedAt:at}],
  renderAction:[{status:'idle'},{status:'succeeded',event,observation:{effectApplied:true,observedAt:at}}],
};
const serialize = node => {
  if (!(node instanceof FakeElement)) return node;
  if (node.hasAttribute('data-student-pc-dashboard')) return null;
  return {tag:node.tagName,text:node._text,attrs:node.attrs,disabled:node.disabled,children:node.children.map(serialize).filter(value=>value!==null)};
};
for (const [name, inputs] of Object.entries(regressionInputs)) {
  for (let number=0; number<inputs.length; number++) {
    try {
      const expected=serialize(baseline[name](structuredClone(inputs[number])));
      const actual=serialize(view[name](structuredClone(inputs[number])));
      check(name+' 기존 표시 회귀 '+(number+1),JSON.stringify(actual)===JSON.stringify(expected));
    } catch (error) { check(name+' 기존 표시 회귀 '+(number+1),false,error.message); }
  }
}
check('조회 경로는 제공 PC GET 하나로 제한', calls.every(url=>url==='/api/pc/status'), calls);
check('전체 모의 시나리오에서 다른 학생 영역 재렌더 호출 없음',onChangeCalls===0,onChangeCalls);
check('자동 조회 타이머 없음', automaticSchedules===0,automaticSchedules);
check('실제 외부 통신 0회', networkCalls===0,networkCalls);
check('금지 HTML 삽입 0회', unsafeCalls===0,unsafeCalls);
check('모의 사용자 이벤트 처리 오류 없음', eventErrors.length===0,eventErrors);
const report={type:'마지막 총공세 합성 PC 입력·독립 모의 DOM·기존 표시 회귀 검사. 실제 PC 수치·실운영·공식 판정 검사가 아닙니다.',checkedAt:new Date().toISOString(),baselineCommit,sourceSha256:createHash('sha256').update(source).digest('hex'),passed:tests.filter(item=>item.passed).length,failed:tests.filter(item=>!item.passed).length,total:tests.length,networkCalls,unsafeCalls,automaticSchedules,syntheticPcRequests:calls.length,tests};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,total:report.total,networkCalls,unsafeCalls,automaticSchedules,syntheticPcRequests:calls.length,output,failures:tests.filter(item=>!item.passed)},null,2));
process.exitCode=report.failed?1:0;
