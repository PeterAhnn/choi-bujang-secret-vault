import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const studentFile = path.join(root, 'on-client/student/extension.mjs');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 5190);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('포트 번호 형식 오류');
const nonce = randomBytes(18).toString('base64');
const page = String.raw`<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>18단계 모의 자료 확인</title>
<style nonce="__NONCE__">
  :root{font:16px/1.6 system-ui,sans-serif;color:#17233b;background:#eef3f8}
  body{max-width:1250px;margin:0 auto;padding:24px}
  h1{font-size:1.5rem}h2{font-size:1.15rem}h4,h5{margin:1rem 0 .3rem}
  .notice{padding:16px;border:2px solid #976300;background:#fff3ca;border-radius:8px}
  .sources{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  article,#student-display{background:white;border:1px solid #c5d2e5;border-radius:8px;padding:16px;margin:16px 0}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.85rem}
  nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
  button{font:inherit;color:#173b71;background:white;border:1px solid #416b9b;border-radius:6px;padding:8px 14px;cursor:pointer}
  button:focus-visible{outline:3px solid #d87800;outline-offset:3px}
  #case-state{font-weight:700}#harness-metadata{color:#4e596b}
  @media(max-width:700px){body{padding:12px}.sources{grid-template-columns:1fr}}
</style>
<main>
  <h1>18단계 모의 자료 · 실제 계정·AI 응답 아님</h1>
  <p class="notice">아래 자료는 화면 검사용 합성 입력입니다. 실제 학생 자료·계정·보안 사건이 아닙니다. 외부 통신·AI 요청·보안 조치는 실행하지 않습니다. 학생 함수의 표시를 원본 근거와 비교하세요.</p>
  <div class="sources" aria-label="합성 사건 원본">
    <article><h2>사건 A 원본</h2><pre id="source-a"></pre></article>
    <article><h2>사건 B 원본</h2><pre id="source-b"></pre></article>
  </div>
  <nav aria-label="모의 입력 선택">
    <button type="button" data-case="a">사건 A</button>
    <button type="button" data-case="b">사건 B</button>
    <button type="button" data-case="mismatch">근거 불일치</button>
    <button type="button" data-case="error">사건 없는 오류</button>
    <button type="button" data-case="proposal">미실행 제안</button>
    <button type="button" data-case="reset">선택 초기화</button>
  </nav>
  <p id="case-state" role="status"></p>
  <p>「미실행 제안」은 A 사건에 가상 지원 조치 <code>revoke_session</code>을 추가한 별도 모의 입력입니다. 실제 조치를 지원하거나 요청하지 않습니다.</p>
  <h2>실제 학생 함수가 반환한 표시</h2>
  <div id="student-display" aria-label="18단계 학생 표시"></div>
  <p id="harness-metadata"></p>
</main>
<script type="module" nonce="__NONCE__">
  import { createStudentView } from '/student/extension.mjs';
  const at = '2026-10-28T01:40:00.000Z';
  const eventA = {
    id:'event-stage18-A',kind:'xdr',at,appId:'library',summary:'모의 사건 A',
    evidence:[{id:'evidence-A1',text:'모의 근거 A: 자료실 접속 판정이 확인되지 않았습니다.'},{id:'evidence-A2',text:'모의 근거 A: 기기의 현재 보안 상태를 확인하지 못했습니다.'}],
    rules:[{id:'rule-A1',text:'모의 규칙 A: 확인 불가 상태를 안전하다고 판단하지 않습니다.'}],
    state:{access:'unknown',session:'active',device:'unknown'},supportedActions:[]
  };
  const eventB = {
    id:'event-stage18-B',kind:'access',at,appId:'repository',summary:'모의 사건 B',
    evidence:[{id:'evidence-B1',text:'모의 근거 B: 개발 저장소의 접속 요청이 거부됐습니다.'}],
    rules:[{id:'rule-B1',text:'모의 규칙 B: 접근 거부와 세션 확인 불가를 구분합니다.'}],
    state:{access:'denied',session:'unknown',device:'compliant'},supportedActions:[]
  };
  const summaries = {
    a:'모의 사건 A의 두 근거를 참고한 해석입니다. 접속과 기기 상태는 확인 불가입니다.',
    b:'모의 사건 B의 근거를 참고한 해석입니다. 접근은 거부됐고 세션 상태는 확인 불가입니다.'
  };
  const view = createStudentView({api:{get(){throw new Error('이 모의 화면은 조회하지 않습니다.');},post(){throw new Error('이 모의 화면은 조치를 요청하지 않습니다.');}},onChange(){}});
  const sourceA = document.getElementById('source-a');
  const sourceB = document.getElementById('source-b');
  sourceA.textContent = JSON.stringify(eventA,null,2);
  sourceB.textContent = JSON.stringify(eventB,null,2);
  const inputFor = (event,summary) => ({event:structuredClone(event),checkedAt:at,explanation:{status:'ok',mode:'demo',data:{summary,evidenceIds:event.evidence.map(e=>e.id),proposals:[],requiresHumanConfirmation:true,executed:false}}});
  const names = {a:'사건 A',b:'사건 B',mismatch:'근거 불일치',error:'사건 없는 오류',proposal:'미실행 제안',reset:'선택 초기화'};
  function selectCase(kind){
    let input;
    if(kind==='reset') input={event:null,checkedAt:null,explanation:{status:'idle',mode:'demo'}};
    else if(kind==='error') input={event:null,checkedAt:at,explanation:{status:'error',mode:'demo',error:{code:'AI_INSUFFICIENT_EVIDENCE',message:'모의 근거 부족: 선택한 사건을 확인할 수 없습니다.'}}};
    else if(kind==='b') input=inputFor(eventB,summaries.b);
    else {
      input=inputFor(eventA,summaries.a);
      if(kind==='mismatch'){
        input.explanation.data.evidenceIds=['evidence-B1'];
        input.explanation.data.summary='근거가 맞지 않아 표시하면 안 되는 모의 요약';
      }
      if(kind==='proposal'){
        input.event.supportedActions=['revoke_session'];
        input.explanation.data.proposals=[{action:'revoke_session',evidenceIds:['evidence-A1'],reason:'모의 제안: 확인 불가 접속을 사람이 검토해야 합니다.'}];
      }
    }
    const output=view.renderExplanation(input);
    document.getElementById('student-display').replaceChildren(output);
    document.getElementById('case-state').textContent='현재 모의 입력: '+names[kind];
    document.getElementById('harness-metadata').textContent='검사 화면이 읽은 성공 속성: '+(output.getAttribute('data-student-explanation-event')??'없음');
  }
  for(const button of document.querySelectorAll('[data-case]'))button.addEventListener('click',()=>selectCase(button.dataset.case));
  selectCase('a');
</script>
</html>`.replaceAll('__NONCE__',nonce);

const server = http.createServer(async (request, response) => {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'self' 'nonce-" + nonce + "'; style-src 'nonce-" + nonce + "'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  };
  if (request.method !== 'GET') { response.writeHead(405, {...headers,Allow:'GET'}); response.end(); return; }
  const pathname = new URL(request.url,'http://127.0.0.1').pathname;
  try {
    if (pathname === '/') { response.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'}); response.end(page); }
    else if (pathname === '/student/extension.mjs') { const source = await readFile(studentFile); response.writeHead(200,{...headers,'Content-Type':'text/javascript; charset=utf-8'}); response.end(source); }
    else { response.writeHead(404,headers); response.end(); }
  } catch {
    response.writeHead(500,headers); response.end('모의 화면 파일을 읽지 못했습니다.');
  }
});
server.listen(port,'127.0.0.1',()=>console.log('18단계 모의 자료 화면: http://127.0.0.1:'+port+'/ · 실제 계정·AI 응답 아님'));
