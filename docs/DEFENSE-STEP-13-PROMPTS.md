# 13단계 공식 원문

확인일: 2026-10-19 (한국 시간)
출처: https://aleph-omega.vercel.app/defense 의 로그인된 시작 안내와 13단계 영역.
아래는 실제 화면에서 추출한 본문이다. 복사 버튼 등 UI 문구와 상세 프롬프트에 중복 포함된 공식 안내도 보존한다. 구현·검증 결과는 DEFENSE-STEP-13.md에서 별도로 기록한다.

## 첫 실행 요청 원문
첫 실행 요청 펼쳐 보기
지금 선택한 프로젝트는 ALEPH 4차 방어전에서 만드는 보안 Agent "나라찬"의 과제 폴더야. 기본 이름은 케셰브(KESHEV)야. 시작 틀의 파일·폴더 이름(예: tools/start-alekov.ps1)은 실행에 쓰는 이름이니 바꾸지 말고 그대로 써.
내가 만들 보안 Agent의 이름은 "나라찬"이야. 지금은 아무것도 바꾸지 말고, 이 이름은 포털·안내·첫 요청문에만 반영되고 이미 받은 프로젝트 파일과 실행 중인 앱 제목은 자동으로 바뀌지 않는다는 점, 그리고 과제 안내에서 허용한 수정 범위를 먼저 설명해 줘.
나는 개발을 처음 배우는 중이니, 코드를 고치기 전에 아래 다섯 가지를 쉬운 말로 확인해 줘.

1. 이 폴더가 4차 방어전 시작 틀이 맞는지 확인해 줘. 프로젝트 맨 위에서 먼저 찾고, 없으면 on-client 폴더 안에서 README.md, student/extension.mjs, tools/start-alekov.ps1 세 파일이 함께 있는 곳을 찾아 줘. 찾은 경로를 알려 주고, 어디에도 없으면 빠진 파일만 알려 줘. 파일을 옮기거나 새로 만들거나 덮어쓰지 마.
2. 이 앱을 누가 왜 쓰는지 한두 문장으로 설명해 줘. (직원이 자기 로그인·기기 상태, 업무 앱 접근 요청 결과, 내 접속 기록과 보안 경보를 확인하는 앱)
3. 내가 고칠 파일은 student/extension.mjs 하나이고, public/app.js 와 src/ 아래는 기본 제공 코드라 고치지 않는다는 점을 확인해 줘.
4. 이 프로젝트의 Git 상태를 읽기만 해서 알려 줘. Git 저장소인지, 커밋이 있는지, origin(원격 저장소 주소)이 등록돼 있는지. 확인할 수 없으면 확인할 수 없다고 그대로 말해 줘. 아직 아무것도 바꾸지 마.
5. 앱을 실행해 화면을 보는 방법을 알려 줘. 1번에서 찾은 폴더에서 PowerShell 을 열고 아래 명령을 실행한 뒤 브라우저에서 http://127.0.0.1:5189 를 여는 방법이 맞는지 README 와 docs/STUDENT_LAUNCH_GUIDE.md 기준으로 확인해 줘.
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1

지켜 줄 것
- 기존 파일, 앞 단계 작업, Git 기록을 지우거나 덮어쓰지 마.
- 비밀번호·토큰·API 키를 묻거나 파일에 적지 마. 나도 대화창에 붙여 넣지 않을게.
- 단계 안내를 받기 전에는 기능을 임의로 추가하지 마.
- 실제로 확인하지 않은 일을 "완료"라고 말하지 마. 확인한 것과 확인하지 못한 것을 나눠서 알려 줘.

설명이 끝나면 "13단계 안내를 붙여 넣어 주세요"라고 말하고 기다려 줘.
첫 요청 복사하기

## 13단계 화면 전체 원문

13단계 · 세 메뉴와 로그인·기기 상태

제출 전

권장일 2026-10-19 · 권장일이 지나도 제출은 그대로 받고, 늦었다는 표시도 하지 않습니다.

AI가 코드를 읽고 모든 확인 항목을 통과로 판정해야 진도에 반영됩니다. 판정을 확인할 수 없으면 통과로 처리하지 않으며, 실패가 아니라 확인 불가로 남겨 다시 검토를 요청할 수 있습니다.

AI 판정 설명 보기
단계 안내 · 13단계 따라 하기와 상세 프롬프트

목표: 직원 본인의 계정, 현재 기기, 로그인 세션을 구분해 표시합니다.

수정 대상: student/extension.mjs → renderIdentity

createStudentView와 renderIdentity의 현재 코드를 먼저 읽고, 반환하는 DOM 구조를 확인합니다.
me·devices·sessions 각각의 loading / ok / error를 처리합니다. 사용자 label·id, 기기 label·id·status, 세션 id·status를 입력값에서 읽습니다.
compliant는 보안 기준 충족, noncompliant는 보안 기준 미충족, unknown은 확인 불가로 표시합니다. 세션 active / expired / revoked / unknown은 활성 / 만료 / 철회됨 / 확인 불가로 구분합니다.
다시 불러오기로 새 데이터가 전달되면 이전 사용자·기기·세션 DOM을 교체합니다. 오류가 발생했을 때 이전 사용자 정보를 현재 값처럼 남기지 않습니다.
직접 확인할 순서
보호 현황·업무 앱·보안 기록 메뉴를 마우스와 Tab·Enter로 이동합니다.
현재 계정에 표시되는 값과 학생 구현 영역을 비교합니다. 다른 사용자나 장애 상태를 임의로 만들지 않습니다. 상태별 분기는 코드를 읽고 확인하거나 별도의 모의 데이터로 점검합니다.

기기 보안 상태 표시는 악성코드 검사나 치료 기능이 아닙니다.

내 보안 Agent의 이름은 「나라찬」이고 지금은 13단계 「로그인 사용자·기기·세션 표시」를 진행해.
아래 공식 과제 안내를 먼저 읽고 현재 파일·함수·입력 계약과 대조해 줘. 안내에 없는 기능이나 제출 조건은 추가하지 마.
목표: 직원 본인의 계정, 현재 기기, 로그인 세션을 구분해 표시합니다.
수정 대상: student/extension.mjs → renderIdentity

진행 방식:
1. 현재 구현을 읽고 유지할 기능, 수정할 함수, 입력 데이터, 확인할 상태를 먼저 설명해 줘. 파일이 없거나 계약이 다르면 추측해서 새 구조를 만들지 말고 차이를 알려 줘.
2. 아래 구현 순서에 따라 작은 단위로 수정해 줘. 각 수정 뒤 변경한 파일·함수와 이유를 짧게 설명하고, 내가 확인할 화면과 예상 결과를 알려 줘.
   1) createStudentView와 renderIdentity의 현재 코드를 먼저 읽고, 반환하는 DOM 구조를 확인합니다.
   2) me·devices·sessions 각각의 loading / ok / error를 처리합니다. 사용자 label·id, 기기 label·id·status, 세션 id·status를 입력값에서 읽습니다.
   3) compliant는 보안 기준 충족, noncompliant는 보안 기준 미충족, unknown은 확인 불가로 표시합니다. 세션 active / expired / revoked / unknown은 활성 / 만료 / 철회됨 / 확인 불가로 구분합니다.
   4) 다시 불러오기로 새 데이터가 전달되면 이전 사용자·기기·세션 DOM을 교체합니다. 오류가 발생했을 때 이전 사용자 정보를 현재 값처럼 남기지 않습니다.
3. 상태 문구는 IT업계에서 쓰는 정확한 한국어로 작성해 줘. API 상태값·함수명·data-* 속성·필수 버튼 이름은 공식 계약대로 유지해. 의미를 바꾸는 의역이나 막연한 성공 안내는 쓰지 마.
4. 학생 화면을 구현하는 단계에서는 DOM을 createElement와 textContent로 작성하고, 색상뿐 아니라 텍스트로 상태를 구분해. 키보드로 조작할 수 있는 label과 버튼을 사용해. 문서 작성 단계에서는 불필요한 UI 변경을 하지 마.
5. 내가 직접 확인할 순서를 한 번에 하나씩 안내해 줘. 코드만 읽은 것, 모의 데이터로 점검한 것, 실제 화면에서 확인한 것을 구분하고 실행하지 않은 검사는 미확인으로 남겨.
   확인 1: 보호 현황·업무 앱·보안 기록 메뉴를 마우스와 Tab·Enter로 이동합니다.
   확인 2: 현재 계정에 표시되는 값과 학생 구현 영역을 비교합니다. 다른 사용자나 장애 상태를 임의로 만들지 않습니다. 상태별 분기는 코드를 읽고 확인하거나 별도의 모의 데이터로 점검합니다.
현재 지원 범위: 기기 보안 상태 표시는 악성코드 검사나 치료 기능이 아닙니다.

기존 학생 코드·앞 단계 기능·Git 기록을 지우거나 덮어쓰지 마. 제공 서버·public/app.js·판정 코드·인증 설정을 수정하지 마. 토큰·비밀번호·API 키를 요청하거나 출력하지 마.
수업용 AI가 명령을 실행할 수 없다면 실행했다고 말하지 말고 내가 PowerShell에서 실행할 명령과 작업 폴더를 알려 줘. 실제 유료 AI 요청·보안 조치·단계 제출은 임의로 실행하지 마.
끝나면 변경 파일, 직접 확인한 결과, 미확인 항목, 다음 작업을 정리해 줘. 커밋 해시나 통과 결과를 만들어 내지 마.

아래는 현재 단계 화면의 공식 과제 안내야. 위 보충 설명과 충돌하면 구현 전에 차이를 알려 줘.
목표: 지금 로그인한 사용자·기기·세션을 상태에 맞게 보여 주고, 다시 불러오면 새 값으로 바꿉니다.

고칠 파일: student/extension.mjs 의 renderIdentity. 다른 함수의 기본 문구는 그대로 둡니다.

받는 값: renderIdentity({ me, devices, sessions }). 셋 다 { status, mode, data?, error? } 입니다. - me.data: { user:{id,label}, device:{id,label,status}, session:{id,status} } - devices.data: [{ id, label, status }], sessions.data: [{ id, status }] - 기기 status: compliant·noncompliant·unknown. 세션 status: active·expired·revoked·unknown.

상태별 표시: | 상황 | 보여 줄 것 | |---|---| | loading | 불러오는 중 | | ok | 사용자 이름, 기기 이름과 상태, 세션 상태. noncompliant·expired·revoked 는 정상처럼 보이지 않게 | | error | 연결 실패 또는 확인 불가와 서버 message. 이전 사용자 값은 지움 | | mode demo | 예제 자료라고 표시 | | mode disconnected / unknown | 연결 없음 / 확인 불가 |

AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderIdentity 만 구현해 줘. 다른 파일과 다른 함수는 건드리지 마. 입력은 { me, devices, sessions } 이고 각각 { status, mode, data?, error? } 야. - status 가 loading 이면 불러오는 중이라는 것을, error 면 서버에 연결하지 못했다는 것과 error.message 를 글자로 보여 줘(예: "연결 실패: " 뒤에 message). - ok 면 me.data.user.label, me.data.device.label 과 status, me.data.session.status 를 보여 줘. - 기기 status 는 compliant=보안 기준 충족, noncompliant=보안 기준 미충족, unknown=확인 불가로, 세션 status 는 active=활성, expired=만료, revoked=철회됨, unknown=확인 불가로 바꿔 보여 줘. - mode 가 demo 면 예제 자료라는 것, disconnected 면 연결이 없다는 것, unknown 이면 확인할 수 없다는 것을 함께 보여 줘(예: "예제 자료", "연결 없음", "확인 불가"). - document.createElement 와 textContent 만 써. innerHTML 은 쓰지 마. DOM 요소 하나를 돌려줘. - 오류일 때 이전에 보이던 사용자 이름이 남지 않게 해.

스스로 확인: 1. 앱을 켜고 보호 현황의 학생 칸에 사용자·기기·세션이 보이는지 봅니다. 2. 다시 불러오기를 누르고 값이 새로 그려지는지 봅니다. 3. 앱 서버를 끈 상태에서 다시 불러오면 연결 실패가 보이고 옛 사용자 이름이 사라지는지 봅니다. 4. 1280px 이상 브라우저에서 세 메뉴를 마우스와 키보드(Tab, Enter)로 오가 봅니다.

필수 확인 항목: student-source-changed, three-menus, student-identity-updates, student-failure-visible, identity-after-reload. AI는 제공 UI와 학생 함수의 원문을 대조해 메뉴 연결, 새 입력에 따른 표시 교체, 실패 안내와 이전 사용자 값 제거를 검토합니다. 실제 실행 결과를 인증하는 것은 아닙니다. 스스로 확인할 때 사용자·기기 값을 바꾸고 실패도 확인합니다. loading·error 상태에서도 전달받은 demo·disconnected·unknown 모드 안내를 함께 표시합니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.

다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.
13단계 상세 프롬프트 복사

공식 과제 안내
목표: 지금 로그인한 사용자·기기·세션을 상태에 맞게 보여 주고, 다시 불러오면 새 값으로 바꿉니다.
고칠 파일: student/extension.mjs 의 renderIdentity. 다른 함수의 기본 문구는 그대로 둡니다.
받는 값: renderIdentity({ me, devices, sessions }). 셋 다 { status, mode, data?, error? } 입니다. - me.data: { user:{id,label}, device:{id,label,status}, session:{id,status} } - devices.data: [{ id, label, status }], sessions.data: [{ id, status }] - 기기 status: compliant·noncompliant·unknown. 세션 status: active·expired·revoked·unknown.
상태별 표시: | 상황 | 보여 줄 것 | |---|---| | loading | 불러오는 중 | | ok | 사용자 이름, 기기 이름과 상태, 세션 상태. noncompliant·expired·revoked 는 정상처럼 보이지 않게 | | error | 연결 실패 또는 확인 불가와 서버 message. 이전 사용자 값은 지움 | | mode demo | 예제 자료라고 표시 | | mode disconnected / unknown | 연결 없음 / 확인 불가 |
AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderIdentity 만 구현해 줘. 다른 파일과 다른 함수는 건드리지 마. 입력은 { me, devices, sessions } 이고 각각 { status, mode, data?, error? } 야. - status 가 loading 이면 불러오는 중이라는 것을, error 면 서버에 연결하지 못했다는 것과 error.message 를 글자로 보여 줘(예: "연결 실패: " 뒤에 message). - ok 면 me.data.user.label, me.data.device.label 과 status, me.data.session.status 를 보여 줘. - 기기 status 는 compliant=보안 기준 충족, noncompliant=보안 기준 미충족, unknown=확인 불가로, 세션 status 는 active=활성, expired=만료, revoked=철회됨, unknown=확인 불가로 바꿔 보여 줘. - mode 가 demo 면 예제 자료라는 것, disconnected 면 연결이 없다는 것, unknown 이면 확인할 수 없다는 것을 함께 보여 줘(예: "예제 자료", "연결 없음", "확인 불가"). - document.createElement 와 textContent 만 써. innerHTML 은 쓰지 마. DOM 요소 하나를 돌려줘. - 오류일 때 이전에 보이던 사용자 이름이 남지 않게 해.
스스로 확인: 1. 앱을 켜고 보호 현황의 학생 칸에 사용자·기기·세션이 보이는지 봅니다. 2. 다시 불러오기를 누르고 값이 새로 그려지는지 봅니다. 3. 앱 서버를 끈 상태에서 다시 불러오면 연결 실패가 보이고 옛 사용자 이름이 사라지는지 봅니다. 4. 1280px 이상 브라우저에서 세 메뉴를 마우스와 키보드(Tab, Enter)로 오가 봅니다.
필수 확인 항목: student-source-changed, three-menus, student-identity-updates, student-failure-visible, identity-after-reload. AI는 제공 UI와 학생 함수의 원문을 대조해 메뉴 연결, 새 입력에 따른 표시 교체, 실패 안내와 이전 사용자 값 제거를 검토합니다. 실제 실행 결과를 인증하는 것은 아닙니다. 스스로 확인할 때 사용자·기기 값을 바꾸고 실패도 확인합니다. loading·error 상태에서도 전달받은 demo·disconnected·unknown 모드 안내를 함께 표시합니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.
다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.

GitHub 저장소 주소와 확인받을 커밋(40자리)을 적어 제출합니다. 서버가 그 커밋의 코드를 그대로 받아 AI가 단계 과제 기준으로 꼼꼼히 읽고 확인합니다. 코드를 실행하지는 않습니다.

저장소 주소
커밋
비공개 저장소 원문 준비 방법

과제 제출용 워크벤치 받기 — Workbench에서 전달했다면 아래 JSON 파일은 따로 선택하지 않아도 됩니다.

원문 전달 도구 받기

도구를 프로젝트 밖에 압축 해제한 뒤, 제출할 프로젝트의 최상위 폴더에서 터미널을 엽니다. Node.js와 Git이 필요합니다.

도구 경로와 프로젝트 밖의 새 JSON 파일 경로를 본인 PC에 맞게 바꿔 실행합니다. 다른 커밋을 선택하려면 --commit 뒤에 40자리 해시를 붙입니다.

node "C:\도구\alekov-source-tool\student-source-cli.mjs" --output "C:\제출자료\alekov-source.json"

만들어진 JSON을 아래에서 선택하고 같은 저장소·커밋으로 제출합니다. 도구는 미커밋 작업을 포함하거나 학생 코드를 실행하지 않습니다.

비공개 저장소 원문 묶음(JSON, 선택 사항)

로컬 도구에서 만든 원문 묶음을 선택하면 비공개 커밋도 확인할 수 있습니다. 원문 전달에 실패해도 제출 접수는 남습니다.

13단계 제출
