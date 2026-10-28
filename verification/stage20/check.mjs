import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { normalizeScan } from '../../on-client/public/vulnerabilities-view.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineCommit = 'a5b77e06db211724215ec57b036b814bee1ca482';
const baselineOnly = process.argv.includes('--baseline');
const output = process.argv.find(v => v.startsWith('--out='))?.slice(6) || path.join(os.tmpdir(), 'alekov-stage20-' + (baselineOnly ? 'baseline' : 'implemented') + '.json');
let networkCalls = 0, unsafeCalls = 0;
const created = [];
class FakeElement {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this._text = ''; this.attrs = {}; this.style = {}; this.listeners = {}; this.disabled = false; created.push(this); }
  set textContent(v) { this._text = String(v ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(n => n instanceof FakeElement ? n.textContent : String(n)).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  set innerHTML(_) { unsafeCalls++; throw Error('innerHTML 사용'); }
  set outerHTML(_) { unsafeCalls++; throw Error('outerHTML 사용'); }
  insertAdjacentHTML() { unsafeCalls++; throw Error('insertAdjacentHTML 사용'); }
}
globalThis.document = { createElement: tag => new FakeElement(tag) };
globalThis.Element = FakeElement;
globalThis.fetch = () => { networkCalls++; throw Error('실제 통신 금지'); };
const api = { get() { networkCalls++; throw Error('학생 직접 조회'); }, post() { networkCalls++; throw Error('학생 직접 요청'); } };
const baselineSource = execFileSync('git', ['-C', repo, 'show', baselineCommit + ':on-client/student/extension.mjs'], { encoding: 'utf8' });
const currentSource = await readFile(path.join(repo, 'on-client/student/extension.mjs'), 'utf8');
const source = baselineOnly ? baselineSource : currentSource;
const load = async s => (await import('data:text/javascript;base64,' + Buffer.from(s).toString('base64'))).createStudentView({api,onChange(){}});
const baseline = await load(baselineSource), view = await load(source);
const tests = [], check = (name, passed, observed = '') => tests.push({name, passed:Boolean(passed), observed});
const text = root => root?.textContent ?? String(root ?? '');
const walk = root => root instanceof FakeElement ? [root, ...root.children.flatMap(walk)] : [];
const rows = root => walk(root).filter(n => n.hasAttribute('data-student-package-name'));
const has = (root, parts) => parts.every(p => text(root).includes(String(p)));
const render = input => { try { return view.renderVulnerabilities(structuredClone(input)); } catch (e) { check('입력별 실행 오류 없음', false, e.message); return null; } };
const at='2026-10-28T02:00:00.000Z', modified='2026-10-27T01:00:00.000Z', SOURCE='https://api.osv.dev/v1/querybatch';
const hashA='a'.repeat(64), hashB='b'.repeat(64);
const pkg=(name='jose',version='6.2.12',status='none_found',findings=[])=>({name,version,status,vulnerabilities:findings,source:SOURCE,checkedAt:at});
const finding={id:'OSV-FIXTURE-STAGE20',modified};
const scan=(status='complete',packages=[pkg()],hash=hashA)=>({status,lockfileVersion:3,lockfileHash:hash,excluded:{count:0},checkedAt:at,packages});
const input=(data)=>({status:'ok',mode:'connected',data});
const good=scan();
for (const state of ['idle','loading','error']) {
  const node=render({status:state,mode:'demo',data:good,error:{code:'SERVICE_UNAVAILABLE',message:'모의 조회 실패 안내'}});
  check(state+' DOM 요소 반환',node instanceof FakeElement);
  check(state+' 이전 패키지 표 없음',rows(node).length===0&&!text(node).includes(hashA),text(node));
  check(state+' 상태 구분',state==='idle'?/조회 전|아직.*조회|조회 대기/.test(text(node)):state==='loading'?/조회 중/.test(text(node)):/실패/.test(text(node)),text(node));
  if(state==='error')check('안전한 오류 메시지 표시',has(node,['모의 조회 실패 안내']),text(node));
}
for(const s of ['complete','partial','not_checked','not_configured','unverifiable']){
  let data=s==='partial'?scan(s,[pkg('jose','6.2.12','unverifiable',[finding])]):s==='not_configured'||s==='unverifiable'?{status:s,code:s==='not_configured'?'PROJECT_NOT_CONFIGURED':'LOCKFILE_UNVERIFIABLE',checkedAt:at,packages:[]}:s==='not_checked'?{...scan(s,[]),code:'NO_APPROVED_PACKAGES'}:good;
  check(s+' 공식 정규화 통과',normalizeScan(data)!==null);
  const node=render(input(data));
  check(s+' 원래 전체 상태값 표시',has(node,[s]),text(node));
  check(s+' 한국어 뜻 표시',/[가-힣]/.test(text(node)),text(node));
  check(s+' 전달된 조회 시각 표시',has(node,[at]),text(node));
  if(s==='not_configured'||s==='not_checked'||s==='unverifiable')check(s+' 미조회·확인 불가를 알려진 항목 없음으로 표시하지 않음',!text(node).includes('알려진 항목 없음(none_found)')&&rows(node).length===0,text(node));
}
const complete=render(input(scan('complete',[pkg('@supabase/supabase-js','2.117.2','known_vulnerabilities',[finding]),pkg()])));
check('lock 버전·해시·시각 표시',has(complete,['3',hashA,at]),text(complete));
check('두 패키지 행 속성과 정확한 버전',rows(complete).some(r=>r.getAttribute('data-student-package-name')==='@supabase/supabase-js'&&r.getAttribute('data-student-package-version')==='2.117.2')&&rows(complete).some(r=>r.getAttribute('data-student-package-name')==='jose'&&r.getAttribute('data-student-package-version')==='6.2.12'));
check('패키지 원래 상태·출처·시각',has(complete,['known_vulnerabilities','none_found',SOURCE,at]),text(complete));
check('취약점 ID·modified 표시',has(complete,[finding.id,modified]),text(complete));
check('none_found 조회 범위이며 안전 보장 아님',/보장.*않|안전.*뜻.*아|안전.*아닙/.test(text(complete)),text(complete));
const partial=render(input(scan('partial',[pkg('jose','6.2.12','unverifiable',[finding])])));
check('partial과 unverifiable 원래값 보존',has(partial,['partial','unverifiable']),text(partial));
check('부분 실패에도 받은 취약점 ID·시각 보존',has(partial,[finding.id,modified]),text(partial));
check('부분 확인·전체 확인 불가 구분',/일부/.test(text(partial))&&/확인 불가/.test(text(partial)),text(partial));
check('빈 complete 목록을 앱 안전으로 표시하지 않음',!/^.*앱.*안전합니다.*$/m.test(text(render(input(scan('complete',[]))))));
const missing=render(input({status:'not_configured',checkedAt:at,packages:[]}));
check('없는 lockVersion·hash를 만들지 않음',!has(missing,[hashA])&&!text(missing).includes('lockfileVersion: 3'),text(missing));
const slot=new FakeElement('div');slot.replaceChildren(complete);slot.replaceChildren(render({status:'loading',mode:'connected'}));
check('진행 상태에서 이전 표·해시 제거',rows(slot).length===0&&!has(slot,[hashA])&&!has(slot,[finding.id]));
slot.replaceChildren(partial);slot.replaceChildren(render({status:'error',error:{code:'CANCELLED',message:'패키지 조회를 취소했습니다.'}}));
check('취소 상태에서 이전 표·ID 제거',rows(slot).length===0&&!has(slot,[finding.id])&&/취소/.test(text(slot)),text(slot));
slot.replaceChildren(complete);slot.replaceChildren(render(input(scan('complete',[pkg('jose','6.2.13')],hashB))));
check('새 hash·버전·목록으로 교체',has(slot,[hashB,'6.2.13'])&&!has(slot,[hashA])&&!has(slot,['2.117.2'])&&!has(slot,[finding.id]),text(slot));
const malicious=render({status:'error',error:{code:'FIXTURE_ERROR',message:'<b>합성 오류</b>'}});
check('HTML을 텍스트로 표시',text(malicious).includes('<b>합성 오류</b>'),text(malicious));
check('학생 조회 버튼을 추가하지 않음',!created.some(n=>n.tagName==='BUTTON'));
check('금지 HTML 삽입 0회',unsafeCalls===0,unsafeCalls);
check('학생 추가 통신 0회',networkCalls===0,networkCalls);
const normalize = s => s.replace(/\r\n/g,'\n');
for(const fn of ['renderIdentity','renderDecision','renderEvents','renderStatus','renderAiConnection','renderExplanation','renderAction'])check(fn+' 원문 보존',normalize(view[fn].toString())===normalize(baseline[fn].toString()));
check('renderVulnerabilities 밖 원문 보존',normalize(source.replace(view.renderVulnerabilities.toString(),'STAGE20_FUNCTION'))===normalize(baselineSource.replace(baseline.renderVulnerabilities.toString(),'STAGE20_FUNCTION')));
check('기준 stub에서 실제 구현으로 변경',normalize(view.renderVulnerabilities.toString())!==normalize(baseline.renderVulnerabilities.toString()));
const lock=JSON.parse(await readFile(path.join(repo,'package-lock.json'),'utf8'));
check('공개 버전 예제가 실제 lock과 일치',lock.packages['node_modules/@supabase/supabase-js']?.version==='2.117.2'&&lock.packages['node_modules/jose']?.version==='6.2.12');

// 제공 코드의 실제 함수 본문을 그대로 격리 실행한다. 요청은 모두 합성 지연 응답이다.
const appSource=await readFile(path.join(repo,'on-client/public/app.js'),'utf8');
const providedFunctions=appSource.slice(appSource.indexOf('function clearVulnerabilities() {'),appSource.indexOf('\nfunction renderApps() {'));
const pending=[],rendered=[],providedSlot=new FakeElement('div');
const context=vm.createContext({AbortController,Promise,setTimeout,clearTimeout,normalizeScan,REQUEST_TIMEOUT_MS:10000,UNKNOWN_META:{},generation:0,vulnerabilitiesGeneration:0,vulnerabilitiesController:null,state:{vulnerabilities:{status:'idle'}},request(url,options){return new Promise(resolve=>pending.push({url,signal:options.signal,resolve}));},localFailure(code,message){return {ok:false,error:{code,message}};},renderVulnerabilities(){const state=context.state.vulnerabilities;rendered.push(structuredClone(state));providedSlot.replaceChildren(render(state));}});
vm.runInContext(providedFunctions+'\nthis.load=loadVulnerabilities;this.cancel=cancelVulnerabilities;this.clear=clearVulnerabilities;',context);
const first=context.load();check('수동 조회마다 지정 API 요청',pending.length===1&&pending[0].url==='/api/vulnerabilities');
pending[0].resolve({ok:false,error:{code:'SERVICE_UNAVAILABLE'}});await first;
check('실패 응답 error 상태 전환',context.state.vulnerabilities.status==='error');
const second=context.load();check('오류 뒤 직접 재조회가 새 요청 생성',pending.length===2);
pending[1].resolve({ok:true,data:good,meta:{}});await second;
check('재조회 성공이 이전 오류 제거',context.state.vulnerabilities.status==='ok'&&!context.state.vulnerabilities.error&&has(providedSlot,[hashA]));
const third=context.load();context.cancel();const countAfterCancel=rendered.length;
check('취소가 요청 중단과 CANCELLED 표시',pending[2].signal.aborted&&context.state.vulnerabilities.error?.code==='CANCELLED');
pending[2].resolve({ok:true,data:scan('complete',[pkg()],hashB),meta:{}});await third;
check('취소 후 늦은 응답이 현재 결과를 덮지 않음',rendered.length===countAfterCancel&&context.state.vulnerabilities.error?.code==='CANCELLED'&&!has(providedSlot,[hashB]));
const old=context.load(),latest=context.load();pending[4].resolve({ok:true,data:scan('complete',[pkg('jose','6.2.13')],hashB),meta:{}});await latest;pending[3].resolve({ok:true,data:good,meta:{}});await old;
check('새 요청 뒤 예전 응답 폐기',context.state.vulnerabilities.data?.lockfileHash===hashB&&!has(providedSlot,[hashA]));
context.clear();check('계정 세대 초기화 뒤 이전 표 제거',context.state.vulnerabilities.status==='idle'&&rows(providedSlot).length===0&&!has(providedSlot,[hashB]));
const report={type:'20단계 독립 모의 DOM·제공 함수 격리 검사. 실제 OSV 조회·계정·공식 판정 검사가 아닙니다.',checkedAt:new Date().toISOString(),baselineCommit,baselineOnly,sourceSha256:createHash('sha256').update(source).digest('hex'),providedFunctionsSha256:createHash('sha256').update(providedFunctions).digest('hex'),passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,total:tests.length,networkCalls,unsafeCalls,syntheticProvidedRequests:pending.length,tests};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,total:report.total,baselineOnly,sourceSha256:report.sourceSha256,networkCalls,unsafeCalls,syntheticProvidedRequests:pending.length,output,failures:tests.filter(t=>!t.passed).map(t=>({name:t.name,observed:t.observed}))},null,2));
process.exitCode=report.failed?1:0;
