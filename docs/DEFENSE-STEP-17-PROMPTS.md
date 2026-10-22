# 17단계 공식 원문

출처: https://aleph-omega.vercel.app/defense
확인일: 2026-10-22 (한국 시간). 현재 로그인된 단계 화면에서 추출한 원문이다.

단계 안내 · 17단계 따라 하기와 상세 프롬프트

목표: AI 연결 점검 결과와 실제 보안 이벤트 설명 실행을 구분합니다.

수정 대상: student/extension.mjs → renderAiConnection, renderExplanation의 기본 표시

보호 현황의 계정 연결 확인에서 「시작」을 누릅니다. 승인 화면에서 같은 계정과 확인 번호를 대조한 뒤 「연결 확인」을 누릅니다.
앱의 AI 연결 영역에서 「AI 연결 시작」 → 「승인 페이지 열기」 → 승인 → 「승인했으며 연결 확인」 순서로 진행합니다. 「현재 API 연결 점검」을 눌러 결과를 확인합니다.
renderAiConnection에서 idle / loading / ok / error를 구분합니다. ok이면 audienceAuthorization의 test / verified, modelCount, checkedAt을 표시합니다.
안전한 error.code·message로 인증·권한·한도·시간 초과·취소·모델 없음 등을 구분합니다. 재점검 성공이나 계정 변경 뒤 이전 결과를 남기지 않습니다. renderExplanation의 기본 표시는 공식 입력 계약을 따릅니다.
직접 확인할 순서
연결 점검만 한 상태에서 사건 설명까지 성공했다고 표시하지 않는지 확인합니다.
워크벤치 수업용 AI, 앱 안의 AI 설명 기능, ALEPH의 공식 과제 판정 AI가 서로 다른 역할임을 설명할 수 있는지 확인합니다.

운영 측 계정 권한이 준비되지 않으면 학생 코드만 수정해 연결할 수 없습니다. API 키를 복사하거나 임의 모델·대체 연결을 추가하지 않습니다.

내 보안 Agent의 이름은 「나라찬」이고 지금은 17단계 「앱 내부 AI 연결 상태 표시」를 진행해.
아래 공식 과제 안내를 먼저 읽고 현재 파일·함수·입력 계약과 대조해 줘. 안내에 없는 기능이나 제출 조건은 추가하지 마.
목표: AI 연결 점검 결과와 실제 보안 이벤트 설명 실행을 구분합니다.
수정 대상: student/extension.mjs → renderAiConnection, renderExplanation의 기본 표시

진행 방식:
1. 현재 구현을 읽고 유지할 기능, 수정할 함수, 입력 데이터, 확인할 상태를 먼저 설명해 줘. 파일이 없거나 계약이 다르면 추측해서 새 구조를 만들지 말고 차이를 알려 줘.
2. 아래 구현 순서에 따라 작은 단위로 수정해 줘. 각 수정 뒤 변경한 파일·함수와 이유를 짧게 설명하고, 내가 확인할 화면과 예상 결과를 알려 줘.
   1) 보호 현황의 계정 연결 확인에서 「시작」을 누릅니다. 승인 화면에서 같은 계정과 확인 번호를 대조한 뒤 「연결 확인」을 누릅니다.
   2) 앱의 AI 연결 영역에서 「AI 연결 시작」 → 「승인 페이지 열기」 → 승인 → 「승인했으며 연결 확인」 순서로 진행합니다. 「현재 API 연결 점검」을 눌러 결과를 확인합니다.
   3) renderAiConnection에서 idle / loading / ok / error를 구분합니다. ok이면 audienceAuthorization의 test / verified, modelCount, checkedAt을 표시합니다.
   4) 안전한 error.code·message로 인증·권한·한도·시간 초과·취소·모델 없음 등을 구분합니다. 재점검 성공이나 계정 변경 뒤 이전 결과를 남기지 않습니다. renderExplanation의 기본 표시는 공식 입력 계약을 따릅니다.
3. 상태 문구는 IT업계에서 쓰는 정확한 한국어로 작성해 줘. API 상태값·함수명·data-* 속성·필수 버튼 이름은 공식 계약대로 유지해. 의미를 바꾸는 의역이나 막연한 성공 안내는 쓰지 마.
4. 학생 화면을 구현하는 단계에서는 DOM을 createElement와 textContent로 작성하고, 색상뿐 아니라 텍스트로 상태를 구분해. 키보드로 조작할 수 있는 label과 버튼을 사용해. 문서 작성 단계에서는 불필요한 UI 변경을 하지 마.
5. 내가 직접 확인할 순서를 한 번에 하나씩 안내해 줘. 코드만 읽은 것, 모의 데이터로 점검한 것, 실제 화면에서 확인한 것을 구분하고 실행하지 않은 검사는 미확인으로 남겨.
   확인 1: 연결 점검만 한 상태에서 사건 설명까지 성공했다고 표시하지 않는지 확인합니다.
   확인 2: 워크벤치 수업용 AI, 앱 안의 AI 설명 기능, ALEPH의 공식 과제 판정 AI가 서로 다른 역할임을 설명할 수 있는지 확인합니다.
현재 지원 범위: 운영 측 계정 권한이 준비되지 않으면 학생 코드만 수정해 연결할 수 없습니다. API 키를 복사하거나 임의 모델·대체 연결을 추가하지 않습니다.

기존 학생 코드·앞 단계 기능·Git 기록을 지우거나 덮어쓰지 마. 제공 서버·public/app.js·판정 코드·인증 설정을 수정하지 마. 토큰·비밀번호·API 키를 요청하거나 출력하지 마.
수업용 AI가 명령을 실행할 수 없다면 실행했다고 말하지 말고 내가 PowerShell에서 실행할 명령과 작업 폴더를 알려 줘. 실제 유료 AI 요청·보안 조치·단계 제출은 임의로 실행하지 마.
끝나면 변경 파일, 직접 확인한 결과, 미확인 항목, 다음 작업을 정리해 줘. 커밋 해시나 통과 결과를 만들어 내지 마.

아래는 현재 단계 화면의 공식 과제 안내야. 위 보충 설명과 충돌하면 구현 전에 차이를 알려 줘.
목표: 앱 서버를 통해서만 수업용 AI 에 연결하고, 연결 결과와 실패 원인을 사용자에게 구분해 안내합니다.

고칠 파일: renderAiConnection, 그리고 renderExplanation 의 기초(18단계에서 넓힘).

연결 순서(제공 화면, 주소·열쇠 입력 없음): 1. 보호 현황의 계정 연결 확인에서 「시작」을 누르고 확인 번호를 봅니다. 승인 화면을 열어 포털에서 같은 계정으로 승인한 뒤 「연결 확인」을 누릅니다. 2. AI 연결 칸에서 「AI 연결 시작」을 누르고 확인 번호를 봅니다. 「승인 페이지 열기」로 승인한 뒤 「승인했으며 연결 확인」을 누릅니다. 3. 연결 완료가 보이면 「현재 API 연결 점검」을 누릅니다.

운영자가 먼저 준비해야 하는 것(학생 잘못이 아님): - 학생 계정과 앱 권한 발급, 수업용 AI 게이트의 새 버전 반영이 끝나야 실제 연결이 됩니다. - 그 전에는 권한 준비 중이나 확인 불가가 나옵니다. 연결 완료로 보이지 않으면 성공으로 적지 않습니다. - Workbench 열쇠나 AI 회사 원본 열쇠를 복사해 붙이지 않습니다.

받는 값: renderAiConnection({ status, mode, data?, error?, checkedAt, explanationAccepted:false }) - data: { transportChecked:true, audienceAuthorization:'test'|'verified', modelCount, help } - 모델 목록 응답만으로 사건 설명이 된 것은 아닙니다. 사건 설명은 보안 기록에서 따로 요청하고 확인합니다. - test 는 시험 연결입니다. verified 는 그 시각 기준 앱 권한 확인과 모델 응답입니다.

오류 구분(화면에 원문 오류·열쇠를 쓰지 않음): | 원인 | 안내 방향 | |---|---| | 권한 준비 중·확인 불가 | 담당자에게 계정 연결과 앱 권한 확인 요청 | | 인증 실패·접근 제한 | 계정 연결 다시 확인, 담당자 확인 | | 반 사용량·이용 한도 | 담당자 확인 | | 이용 시간 아님 | 이용 시간 확인 | | 요청 제한·시간 초과·네트워크 | 잠시 뒤 직접 다시 점검 | | 취소 | 취소됨. 이전 결과는 현재 결과가 아님 | | 쓸 수 있는 모델 없음 | 담당자에게 모델 허용 설정 확인 요청 |

AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderAiConnection 을 구현하고, renderExplanation 은 기초만 만들어 줘. 앞 단계 함수는 그대로 둬. renderAiConnection 입력은 { status, mode, data?, error?, checkedAt, explanationAccepted } 야. - status 가 idle 이면 아직 점검 전이라는 것, loading 이면 점검 중이라는 것을 보여 줘(예: "AI 연결 점검 전", "AI 연결 점검 중"). - ok 면 audienceAuthorization 이 test 일 때 "시험 연결 점검(test)", verified 일 때 "앱 권한 확인 후 점검(verified)" 이라고 적고 modelCount 와 checkedAt 을 함께 보여 줘. - ok 화면에는 연결만 점검했고 사건 설명은 아직 실행하지 않았다는 것을 분명히 적어(예: "사건 설명은 아직 실행하지 않았습니다"). 모델 목록 응답을 사건 설명이 된 것처럼 쓰지 마. - error 면 안전한 error.code 와 error.message 를 함께 글자로 보여 주고, code 로 원인을 나눠 안내해: 권한 준비 중, 인증, 접근 제한, 사용량·한도, 이용 시간, 요청 제한·시간 초과·네트워크, 취소, 모델 없음. 열쇠나 원문 오류는 쓰지 마. - 다시 점검해 성공하면 이전 오류 안내(권한·인증 등)는 화면에서 지워져야 해. 현재 점검 결과만 보이게 해. - 다시 idle 이 오면(계정 연결을 다시 하는 경우 등) 이전 점검 결과를 지우고 아직 점검 전인 상태로 되돌려(예: "AI 연결 점검 전"). - 자동으로 다시 점검하지 마. 다시 점검은 사용자가 버튼을 직접 누르는 것이라고 안내해. renderExplanation 입력은 { event, explanation, checkedAt } 야. 지금은 explanation.status 가 ok 일 때 바깥 요소에 data-student-explanation-event 속성으로 event.id 를 붙이고, 사건 ID 와 explanation.data.summary 를 글자로 보여 줘. 실패면 안전한 code 와 message 를 보여 주고 기록은 그대로라고 적어. 실패 화면에는 data-student-explanation-event 를 붙이지 마. textContent 만 써.

스스로 확인: 1. 연결 전 점검 결과가 권한 준비 중으로 보이는지, 그것이 내 잘못으로 적히지 않는지 봅니다. 2. 점검 중 「취소」를 누르면 늦게 온 응답이 다시 나타나지 않는지 봅니다. 3. 계정 연결을 다시 하면 옛 점검 결과가 지워지는지 봅니다. 4. 화면·도움정보·커밋에 열쇠가 없는지 봅니다. 실수로 커밋했다면 바로 담당자에게 알리고 열쇠 교체를 요청합니다.

필수 확인 항목: student-source-changed, ai_transport_checked, ai_model_called, ai_auth_error, ai_limits, ai_manual_recovery, ai_generation_reset, secret_absence, ai_timeout_cancel. 모델 목록만 되고 실제 사건 설명 호출이 막히면 ai_model_called 는 통과하지 못합니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.

다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.
17단계 상세 프롬프트 복사

---

공식 과제 안내
목표: 앱 서버를 통해서만 수업용 AI 에 연결하고, 연결 결과와 실패 원인을 사용자에게 구분해 안내합니다.
고칠 파일: renderAiConnection, 그리고 renderExplanation 의 기초(18단계에서 넓힘).
연결 순서(제공 화면, 주소·열쇠 입력 없음): 1. 보호 현황의 계정 연결 확인에서 「시작」을 누르고 확인 번호를 봅니다. 승인 화면을 열어 포털에서 같은 계정으로 승인한 뒤 「연결 확인」을 누릅니다. 2. AI 연결 칸에서 「AI 연결 시작」을 누르고 확인 번호를 봅니다. 「승인 페이지 열기」로 승인한 뒤 「승인했으며 연결 확인」을 누릅니다. 3. 연결 완료가 보이면 「현재 API 연결 점검」을 누릅니다.
운영자가 먼저 준비해야 하는 것(학생 잘못이 아님): - 학생 계정과 앱 권한 발급, 수업용 AI 게이트의 새 버전 반영이 끝나야 실제 연결이 됩니다. - 그 전에는 권한 준비 중이나 확인 불가가 나옵니다. 연결 완료로 보이지 않으면 성공으로 적지 않습니다. - Workbench 열쇠나 AI 회사 원본 열쇠를 복사해 붙이지 않습니다.
받는 값: renderAiConnection({ status, mode, data?, error?, checkedAt, explanationAccepted:false }) - data: { transportChecked:true, audienceAuthorization:'test'|'verified', modelCount, help } - 모델 목록 응답만으로 사건 설명이 된 것은 아닙니다. 사건 설명은 보안 기록에서 따로 요청하고 확인합니다. - test 는 시험 연결입니다. verified 는 그 시각 기준 앱 권한 확인과 모델 응답입니다.
오류 구분(화면에 원문 오류·열쇠를 쓰지 않음): | 원인 | 안내 방향 | |---|---| | 권한 준비 중·확인 불가 | 담당자에게 계정 연결과 앱 권한 확인 요청 | | 인증 실패·접근 제한 | 계정 연결 다시 확인, 담당자 확인 | | 반 사용량·이용 한도 | 담당자 확인 | | 이용 시간 아님 | 이용 시간 확인 | | 요청 제한·시간 초과·네트워크 | 잠시 뒤 직접 다시 점검 | | 취소 | 취소됨. 이전 결과는 현재 결과가 아님 | | 쓸 수 있는 모델 없음 | 담당자에게 모델 허용 설정 확인 요청 |
AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderAiConnection 을 구현하고, renderExplanation 은 기초만 만들어 줘. 앞 단계 함수는 그대로 둬. renderAiConnection 입력은 { status, mode, data?, error?, checkedAt, explanationAccepted } 야. - status 가 idle 이면 아직 점검 전이라는 것, loading 이면 점검 중이라는 것을 보여 줘(예: "AI 연결 점검 전", "AI 연결 점검 중"). - ok 면 audienceAuthorization 이 test 일 때 "시험 연결 점검(test)", verified 일 때 "앱 권한 확인 후 점검(verified)" 이라고 적고 modelCount 와 checkedAt 을 함께 보여 줘. - ok 화면에는 연결만 점검했고 사건 설명은 아직 실행하지 않았다는 것을 분명히 적어(예: "사건 설명은 아직 실행하지 않았습니다"). 모델 목록 응답을 사건 설명이 된 것처럼 쓰지 마. - error 면 안전한 error.code 와 error.message 를 함께 글자로 보여 주고, code 로 원인을 나눠 안내해: 권한 준비 중, 인증, 접근 제한, 사용량·한도, 이용 시간, 요청 제한·시간 초과·네트워크, 취소, 모델 없음. 열쇠나 원문 오류는 쓰지 마. - 다시 점검해 성공하면 이전 오류 안내(권한·인증 등)는 화면에서 지워져야 해. 현재 점검 결과만 보이게 해. - 다시 idle 이 오면(계정 연결을 다시 하는 경우 등) 이전 점검 결과를 지우고 아직 점검 전인 상태로 되돌려(예: "AI 연결 점검 전"). - 자동으로 다시 점검하지 마. 다시 점검은 사용자가 버튼을 직접 누르는 것이라고 안내해. renderExplanation 입력은 { event, explanation, checkedAt } 야. 지금은 explanation.status 가 ok 일 때 바깥 요소에 data-student-explanation-event 속성으로 event.id 를 붙이고, 사건 ID 와 explanation.data.summary 를 글자로 보여 줘. 실패면 안전한 code 와 message 를 보여 주고 기록은 그대로라고 적어. 실패 화면에는 data-student-explanation-event 를 붙이지 마. textContent 만 써.
스스로 확인: 1. 연결 전 점검 결과가 권한 준비 중으로 보이는지, 그것이 내 잘못으로 적히지 않는지 봅니다. 2. 점검 중 「취소」를 누르면 늦게 온 응답이 다시 나타나지 않는지 봅니다. 3. 계정 연결을 다시 하면 옛 점검 결과가 지워지는지 봅니다. 4. 화면·도움정보·커밋에 열쇠가 없는지 봅니다. 실수로 커밋했다면 바로 담당자에게 알리고 열쇠 교체를 요청합니다.
필수 확인 항목: student-source-changed, ai_transport_checked, ai_model_called, ai_auth_error, ai_limits, ai_manual_recovery, ai_generation_reset, secret_absence, ai_timeout_cancel. 모델 목록만 되고 실제 사건 설명 호출이 막히면 ai_model_called 는 통과하지 못합니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.
다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.