# 18단계 공식 원문

확인일: 2026-10-28 (한국 시간)
출처: https://aleph-omega.vercel.app/defense 의 열린 18단계 상세 안내

```text
단계 안내 · 18단계 따라 하기와 상세 프롬프트

목표: AI 요약을 선택한 이벤트의 근거·규칙·현재 상태와 함께 표시합니다.

수정 대상: student/extension.mjs → renderExplanation

explanation.status가 error이면 event가 null이어도 안전한 오류 코드·메시지와 근거 부족 등 실패 이유를 먼저 표시합니다. 오류 없이 event만 null인 경우에는 보안 기록을 먼저 선택하도록 안내합니다. 요청 중·성공·실패를 구분합니다.
성공한 설명에만 data-student-explanation-event=event.id를 지정합니다. 이벤트 ID·참고용 AI 요약을 표시합니다.
evidenceIds를 현재 event.evidence의 id와 대조하고 해당 근거 문장을 표시합니다. 규칙은 id와 text를 함께 표시합니다.
access·session·device 중 unknown인 값을 각각 확인 불가로 표시합니다. proposals는 이유와 미실행 상태를 표시합니다. 지원 조치가 없으면 제안이 없는 이유를 설명합니다.
다른 이벤트 선택·새로고침·실패 시 이전 설명과 성공 속성을 제거합니다. 없는 근거 ID를 만들어 맞추지 않습니다.
직접 확인할 순서
선택한 이벤트 ID와 설명의 근거 ID가 일치하는지 확인합니다.
실제 설명 기능을 사용할 수 없는 상태는 미확인으로 남깁니다. 확인을 위해 유료 요청을 반복하지 않습니다.

AI 설명은 참고 정보입니다. 설명·제안만으로 보안 조치가 실행되지는 않습니다.

내 보안 Agent의 이름은 ‘나라찬’이고 지금은 18단계 ‘근거에 연결된 AI 보안 이벤트 설명’를 진행해.
아래 공식 과제 안내를 먼저 읽고 현재 파일·함수·입력 계약과 대조해 줘. 안내에 없는 기능이나 제출 조건은 추가하지 마.
목표: AI 요약을 선택한 이벤트의 근거·규칙·현재 상태와 함께 표시합니다.
수정 대상: student/extension.mjs → renderExplanation

진행 방식:
1. 현재 구현을 읽고 유지할 기능, 수정할 함수, 입력 데이터, 확인할 상태를 먼저 설명해 줘. 파일이 없거나 계약이 다르면 추측해서 새 구조를 만들지 말고 차이를 알려 줘.
2. 아래 구현 순서에 따라 작은 단위로 수정해 줘. 각 수정 뒤 변경한 파일·함수와 이유를 짧게 설명하고, 내가 확인할 화면과 예상 결과를 알려 줘.
   1) explanation.status가 error이면 event가 null이어도 안전한 오류 코드·메시지와 근거 부족 등 실패 이유를 먼저 표시합니다. 오류 없이 event만 null인 경우에는 보안 기록을 먼저 선택하도록 안내합니다. 요청 중·성공·실패를 구분합니다.
   2) 성공한 설명에만 data-student-explanation-event=event.id를 지정합니다. 이벤트 ID·참고용 AI 요약을 표시합니다.
   3) evidenceIds를 현재 event.evidence의 id와 대조하고 해당 근거 문장을 표시합니다. 규칙은 id와 text를 함께 표시합니다.
   4) access·session·device 중 unknown인 값을 각각 확인 불가로 표시합니다. proposals는 이유와 미실행 상태를 표시합니다. 지원 조치가 없으면 제안이 없는 이유를 설명합니다.
   5) 다른 이벤트 선택·새로고침·실패 시 이전 설명과 성공 속성을 제거합니다. 없는 근거 ID를 만들어 맞추지 않습니다.
3. 상태 문구는 IT업계에서 쓰는 정확한 한국어로 작성해 줘. API 상태값·함수명·data-* 속성·필수 버튼 이름은 공식 계약대로 유지해. 의미를 바꾸는 의역이나 막연한 성공 안내는 쓰지 마.
4. 학생 화면을 구현하는 단계에서는 DOM을 createElement와 textContent로 작성하고, 색상뿐 아니라 텍스트로 상태를 구분해. 키보드로 조작할 수 있는 label과 버튼을 사용해. 문서 작성 단계에서는 불필요한 UI 변경을 하지 마.
5. 내가 직접 확인할 순서를 한 번에 하나씩 안내해 줘. 코드만 읽은 것, 모의 데이터로 점검한 것, 실제 화면에서 확인한 것을 구분하고 실행하지 않은 검사는 미확인으로 남겨.
   확인 1: 선택한 이벤트 ID와 설명의 근거 ID가 일치하는지 확인합니다.
   확인 2: 실제 설명 기능을 사용할 수 없는 상태는 미확인으로 남깁니다. 확인을 위해 유료 요청을 반복하지 않습니다.
현재 지원 범위: AI 설명은 참고 정보입니다. 설명·제안만으로 보안 조치가 실행되지는 않습니다.

기존 학생 코드·앞 단계 기능·Git 기록을 지우거나 덮어쓰지 마. 제공 서버·public/app.js·판정 코드·인증 설정을 수정하지 마. 토큰·비밀번호·API 키를 요청하거나 출력하지 마.
수업용 AI가 명령을 실행할 수 없다면 실행했다고 말하지 말고 내가 PowerShell에서 실행할 명령과 작업 폴더를 알려 줘. 실제 유료 AI 요청·보안 조치·단계 제출은 임의로 실행하지 마.
끝나면 변경 파일, 직접 확인한 결과, 미확인 항목, 다음 작업을 정리해 줘. 커밋 해시나 통과 결과를 만들어 내지 마.

아래는 현재 단계 화면의 공식 과제 안내야. 위 보충 설명과 충돌하면 구현 전에 차이를 알려 줘.
목표: AI 설명이 그 기록의 근거·규칙·현재 상태와 이어지게 보여 주고, 근거가 없으면 지어내지 않습니다.

고칠 파일: renderExplanation 을 완성합니다.

받는 값: renderExplanation({ event, explanation, checkedAt }) - event: 보안 기록에서 고른 기록(15단계와 같은 모양) 또는 null - explanation: { status, mode, data?, error? }, data 는 { summary, evidenceIds, proposals:[{action,evidenceIds,reason}], requiresHumanConfirmation:true, executed:false } - 제공 코드가 이미 검사한 것: 모든 근거 ID 를 빠짐없이 인용했는지, 없는 ID·중복·지원하지 않는 조치·비밀 표기·executed:true 가 없는지. 맞지 않으면 학생 함수에는 실패로 전달됩니다.

지금 알아 둘 것: - 지금 기록의 supportedActions 는 비어 있어서 AI 제안은 0개가 정상입니다. 이때는 연동 시스템이 지원하는 조치가 없어 제안이 없다고 안내합니다. - AI 설명은 해석입니다. 사실 판단은 근거 글과 연동 시스템이 알려 준 상태로 합니다. unknown 은 확인 불가이며 안전이나 정상으로 바꾸지 않습니다. - AI 연결이 실패해도 업무 앱 판정과 보안 기록은 계속 동작해야 합니다.

상태별 표시: | 상황 | 보여 줄 것 | |---|---| | event 없음 | 기록을 먼저 고르라는 안내 | | loading | 설명 요청 중 | | ok | 사건 ID, AI 요약, 인용한 근거 ID 와 근거 글, 규칙 글, 확인 불가 상태 목록, 제안(없으면 없는 까닭) | | error | 설명 실패와 message. 기록은 그대로이며 과제 실패가 아님 |

AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderExplanation 을 완성해 줘. 앞 단계 함수는 그대로 둬. 입력은 { event, explanation, checkedAt } 야. - event 가 null 이면 보안 기록에서 기록을 먼저 고르라는 안내(예: "보안 기록에서 기록을 먼저 고르세요"). - explanation.status 가 ok 면 바깥 요소에 data-student-explanation-event 속성으로 event.id 를 붙이고 다음을 보여 줘: 1) 사건 ID(event.id)를 글자로, AI 설명이 참고용이라는 제목(예: "AI 설명(참고용)")과 explanation.data.summary 2) evidenceIds 마다 event.evidence 에서 같은 id 를 찾아 "근거 ID — 근거 글" 3) event.rules 마다 "규칙 ID — 규칙 글"(id 와 text 를 함께) 4) event.state 에서 unknown 인 항목을 접속·세션·기기별로 나눠, 확인할 수 없다는 것과 원래 값(unknown)을 함께 나열(예: "접속: 확인 불가(unknown)", 없으면 "없음"). 확인할 수 없는 상태를 정상·안전으로 적지 마. 5) proposals 가 비었으면 제안이 없는 까닭을 알려 줘. event.supportedActions 가 비었으면 연동 시스템이 지원하는 조치가 없어 제안이 없는 것이 정상이라는 것, 아니면 AI 가 제안한 조치가 없다는 것(예: "연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상)") 6) proposals 가 있으면 각 action 과 reason, 그리고 사람이 확인해야 실행되며 아직 실행되지 않았다는 것(예: "사람 확인이 필요하며 실행되지 않았습니다") - 근거 ID 가 event.evidence 에 없으면 그 설명을 쓸 수 없다는 것과 까닭(근거가 맞지 않음)을 보여 주고 내용을 지어내지 마. 안전한 error.code 가 있으면 함께 보여 줘. - error 면 AI 설명이 실패했다는 것과 안전한 error.code·message, 그리고 기록은 그대로라는 것을 보여 줘(예: "AI 설명 실패: ", "기록은 그대로입니다"). AI 가 이미 실행했다고 답한 설명은 쓸 수 없다고 보여 줘. - 실패·자료 없음·근거 불일치 화면에는 data-student-explanation-event 를 붙이지 마. 성공 표식은 성공한 설명에만 붙여. - 다른 기록을 고르거나 다시 불러오면 이전 설명을 지워. - 실행 버튼은 만들지 마. textContent 만 써.

스스로 확인: 1. 서로 다른 기록 두 개로 설명을 받아, 근거·규칙이 각 기록 것과 맞는지 봅니다. 2. unknown 상태가 있는 기록에서 확인 불가가 보이는지 봅니다. 3. 설명 요청 중 다른 기록을 고르면 늦게 온 설명이 엉뚱한 기록에 붙지 않는지 봅니다. 4. AI 가 실패해도 업무 앱 판정과 기록 목록이 그대로 되는지 봅니다.

필수 확인 항목: student-source-changed, evidence_binding, unknown_evidence, insufficient_evidence, wrong_event_rejected, proposal_not_executed, non_ai_regression, explanation_refresh. data-student-explanation-event 속성만 붙였다고 통과하지 않습니다.  AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.

다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.
18단계 상세 프롬프트 복사
```
