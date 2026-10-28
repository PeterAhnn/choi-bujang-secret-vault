# 19단계 공식 원문

확인일: 2026-10-28 (한국 시간)
출처: https://aleph-omega.vercel.app/defense 의 열린 19단계 상세 안내

```text
단계 안내 · 19단계 따라 하기와 상세 프롬프트

목표: 조치 제안·사용자 확인·요청 접수·실제 효과 확인을 구분해 표시합니다.

수정 대상: student/extension.mjs → renderAction

공식 안내의 입력 필드와 상태 표를 읽고 상태별 표시 함수를 구성합니다. 조치 버튼·POST 요청·인증 티켓을 학생 코드에 추가하지 않습니다.
loading은 조치 준비 또는 결과 조회 중, prepared는 준비됨·미실행, executing은 전송 중, pending은 접수·처리 중으로 표시합니다. 접수 응답(ACK)을 실행 성공으로 표시하지 않습니다.
succeeded이면서 observation.effectApplied===true인 경우에만 효과 확인으로 표시합니다. 관측 시각·receiptId를 함께 표시하고, 조건이 맞지 않으면 결과 불명으로 처리합니다.
현재 event.id·근거 ID·actionId·target.id·generation·requestId·receiptId·version을 받은 범위에서 표시합니다. unknown은 성공이나 효과 없음으로 단정하지 않고 결과 재조회를 안내합니다.
직접 확인할 순서
상태별 표시를 모의 입력으로 점검한 결과와 실제 환경에서 실행한 결과를 구분해 기록합니다.
새 입력이 전달되면 이전 대상·요청·결과가 남지 않는지 확인합니다. 실제 집행을 시험 삼아 요청하지 않습니다. ‘조치 화면 취소’는 이미 서버에 전달된 조치 효과를 되돌리는 기능이 아닙니다.

보안 조치를 실제로 처리하는 시스템 연결은 아직 준비되지 않았습니다. 학생이 운영자 권한을 받거나 집행 서버를 구축할 필요는 없습니다.

내 보안 Agent의 이름은 ‘나라찬’이고 지금은 19단계 ‘보안 조치 요청 상태와 실제 결과 구분’를 진행해.
아래 공식 과제 안내를 먼저 읽고 현재 파일·함수·입력 계약과 대조해 줘. 안내에 없는 기능이나 제출 조건은 추가하지 마.
목표: 조치 제안·사용자 확인·요청 접수·실제 효과 확인을 구분해 표시합니다.
수정 대상: student/extension.mjs → renderAction

진행 방식:
1. 현재 구현을 읽고 유지할 기능, 수정할 함수, 입력 데이터, 확인할 상태를 먼저 설명해 줘. 파일이 없거나 계약이 다르면 추측해서 새 구조를 만들지 말고 차이를 알려 줘.
2. 아래 구현 순서에 따라 작은 단위로 수정해 줘. 각 수정 뒤 변경한 파일·함수와 이유를 짧게 설명하고, 내가 확인할 화면과 예상 결과를 알려 줘.
   1) 공식 안내의 입력 필드와 상태 표를 읽고 상태별 표시 함수를 구성합니다. 조치 버튼·POST 요청·인증 티켓을 학생 코드에 추가하지 않습니다.
   2) loading은 조치 준비 또는 결과 조회 중, prepared는 준비됨·미실행, executing은 전송 중, pending은 접수·처리 중으로 표시합니다. 접수 응답(ACK)을 실행 성공으로 표시하지 않습니다.
   3) succeeded이면서 observation.effectApplied===true인 경우에만 효과 확인으로 표시합니다. 관측 시각·receiptId를 함께 표시하고, 조건이 맞지 않으면 결과 불명으로 처리합니다.
   4) 현재 event.id·근거 ID·actionId·target.id·generation·requestId·receiptId·version을 받은 범위에서 표시합니다. unknown은 성공이나 효과 없음으로 단정하지 않고 결과 재조회를 안내합니다.
3. 상태 문구는 IT업계에서 쓰는 정확한 한국어로 작성해 줘. API 상태값·함수명·data-* 속성·필수 버튼 이름은 공식 계약대로 유지해. 의미를 바꾸는 의역이나 막연한 성공 안내는 쓰지 마.
4. 학생 화면을 구현하는 단계에서는 DOM을 createElement와 textContent로 작성하고, 색상뿐 아니라 텍스트로 상태를 구분해. 키보드로 조작할 수 있는 label과 버튼을 사용해. 문서 작성 단계에서는 불필요한 UI 변경을 하지 마.
5. 내가 직접 확인할 순서를 한 번에 하나씩 안내해 줘. 코드만 읽은 것, 모의 데이터로 점검한 것, 실제 화면에서 확인한 것을 구분하고 실행하지 않은 검사는 미확인으로 남겨.
   확인 1: 상태별 표시를 모의 입력으로 점검한 결과와 실제 환경에서 실행한 결과를 구분해 기록합니다.
   확인 2: 새 입력이 전달되면 이전 대상·요청·결과가 남지 않는지 확인합니다. 실제 집행을 시험 삼아 요청하지 않습니다. ‘조치 화면 취소’는 이미 서버에 전달된 조치 효과를 되돌리는 기능이 아닙니다.
현재 지원 범위: 보안 조치를 실제로 처리하는 시스템 연결은 아직 준비되지 않았습니다. 학생이 운영자 권한을 받거나 집행 서버를 구축할 필요는 없습니다.

기존 학생 코드·앞 단계 기능·Git 기록을 지우거나 덮어쓰지 마. 제공 서버·public/app.js·판정 코드·인증 설정을 수정하지 마. 토큰·비밀번호·API 키를 요청하거나 출력하지 마.
수업용 AI가 명령을 실행할 수 없다면 실행했다고 말하지 말고 내가 PowerShell에서 실행할 명령과 작업 폴더를 알려 줘. 실제 유료 AI 요청·보안 조치·단계 제출은 임의로 실행하지 마.
끝나면 변경 파일, 직접 확인한 결과, 미확인 항목, 다음 작업을 정리해 줘. 커밋 해시나 통과 결과를 만들어 내지 마.

아래는 현재 단계 화면의 공식 과제 안내야. 위 보충 설명과 충돌하면 구현 전에 차이를 알려 줘.
목표: AI 제안과 실제 처리를 나눕니다. 서버가 지원하는 조치만 사람 확인 → 서버 전달 → 서버 결과 재조회 순서로 처리되며, 학생 화면은 그 상태를 정확히 보여 줍니다.

고칠 파일: renderAction.

제공 화면이 하는 일: AI 제안의 「조치 준비」, 실제 대상과 확인 기한 표시, 「대상과 조치를 확인했으며 집행합니다」, 「연동 시스템 결과만 재조회」, 「조치 화면 취소」. 확인 티켓은 제공 화면 메모리에만 있고 학생 함수에는 전달되지 않습니다.

받는 값: renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt?, error? }) - status: idle·loading·executing·prepared·pending·succeeded·denied·failed·unknown·error·expired - target: { id, generation } 또는 null. receipt: requestId·receiptId·eventId·actionId·status·version·replayed 등 - observation: { observedAt, effectApplied } 또는 null

지금 알아 둘 것: - 지금 기록에는 연동 시스템이 지원하는 조치가 없어(supportedActions 빈 배열) 실제 처리 경로가 열리지 않습니다. 화면에 조치 준비 버튼이 나오지 않는 것이 정상입니다. - 이 단계의 현재 내부 자동 확인은 시험용 연동 시스템에서 학생 화면이 제안·사람 확인·ACK·효과 관측을 구분하는지 확인하는 학습 계약입니다. 이 결과만으로 실제 학생의 SDP 권한·대상·집행·결과 재조회가 연결되었다고 인정하지 않습니다. - 전체 구현 목표에는 실제 연동 시스템 집행기 연결과, 같은 학생·프로젝트·대상에 대한 실행 결과 확인이 계속 포함됩니다. 그 부분은 지금 미완료입니다. 운영자 담당이라는 이유로 전체 완료 조건에서 빼지 않습니다. 다만 학생 개인에게 운영자 자격 발급이나 집행기 구축을 요구하지는 않습니다. - 실제 학생 계정의 조치 처리 결과는 기다림(UNV)입니다.

상태별 표시: | status | 뜻 | 보여 줄 것 | |---|---|---| | idle | 아직 아무것도 안 함 | 아직 미실행 | | prepared | 준비만 됨 | 준비됨·미실행, 사건·근거 ID·조치·실제 대상·확인 기한 | | executing | 서버에 전달 중 | 서버에 전달 중(executing). 결과가 아직 없음 | | pending | 서버가 받음 | 서버 접수·처리 중(pending). 서버가 받았다는 것(ACK)은 효과가 아님 | | succeeded | 연동 시스템이 효과를 확인 | observation.effectApplied 가 true 일 때만 "효과 확인(succeeded)", 관측 시각, effectApplied: true, receiptId | | denied / failed | 연동 시스템 거절 / 실패 | 거절·실패와 message | | unknown | 결과 불명 | 효과 없음으로도 성공으로도 판단하지 말고 결과만 재조회하라고 안내 | | expired | 확인 기한 지남 | 다시 준비하라고 안내 | | error | 요청이 처리되지 않음 | error.message |

AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderAction 을 구현해 줘. 앞 단계 함수는 그대로 둬. 입력은 { status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } 야. - status 마다 뜻이 다른 문장을 원래 값과 함께 보여 줘. 예: idle=아직 미실행, prepared=준비됨·미실행(확인 기한 confirmationExpiresAt 을 함께), executing=서버에 전달 중(executing), pending=서버 접수·처리 중(pending), succeeded=효과 확인(succeeded), denied=거절(denied), failed=실패(failed), unknown=결과 불명(unknown)·효과 없음으로 판단 금지, expired=확인 기한 지남(expired)·다시 준비, error=요청 처리 안 됨과 안전한 error.code·message. - executing·pending 화면은 서버에 전달 중이거나 서버가 받아 처리 중이라는 상태만 전해 줘. 결과가 아직 확인되지 않았다는 것이 드러나야 하고, 읽는 사람이 끝났거나 성공했다고 받아들일 문장은 쓰지 마. "완료 아님"처럼 부정하는 문장은 오해 없이 읽히면 괜찮아. - succeeded 는 observation.effectApplied 가 true 일 때만 "효과 확인(succeeded)" 과 관측 시각 observation.observedAt, "effectApplied: true" 를 함께 보여 줘. 아니면 결과 불명으로. - 현재 사건의 event.id 와 근거 ID(event.evidence 의 id), actionId, target.id 와 target.generation, receipt.requestId, receipt.receiptId, receipt.version 을 있는 것만 글자로 보여 줘. - 성공적으로 그린 바깥 요소에 data-student-action-event 로 event.id, data-student-action-request 로 receipt.requestId 를 붙여. - 확인 번호 같은 값은 입력에 없으니 만들거나 저장하지 마. 버튼을 만들지 말고 제공 화면 버튼을 쓰게 안내해. - 새 값이 오면 이전 표시를 모두 지우고 다시 그려. textContent 만 써.

스스로 확인: 1. 지금 기록에서 조치 준비 버튼이 나오지 않고, 그것이 정상이라는 안내가 보이는지 봅니다. 2. 학생 칸이 status 마다 다른 문장을 보여 주는지, 연동 시스템 효과가 없을 때 성공으로 보이지 않는지 코드로 다시 읽어 봅니다. 3. 다시 불러오기나 다른 기록 선택 뒤 이전 조치 표시가 지워지는지 봅니다.

필수 확인 항목: student-source-changed, proposal_execution_separation, human_confirmation, current_intent_binding, observed_server_result, duplicate_prevention, unknown_not_success, action_refresh. 속성만 붙여서는 통과하지 않습니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.

다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.
19단계 상세 프롬프트 복사
```
