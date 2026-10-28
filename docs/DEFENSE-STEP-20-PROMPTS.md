# 20단계 공식 원문

출처: https://aleph-omega.vercel.app/defense
확인일: 2026-10-28 (한국 시간)

20단계 · 사용 라이브러리와 취약점 정보 대조

제출 전

AI 연결이 ‘NATIVE_HOST_DISABLED’나 ‘확인 불가’로 막히면 예전 시작 틀 때문입니다. 케셰브 앱을 최신 시작 틀(0.2.21)로 바꾼 뒤 다시 연결하세요. 업데이트 안내 보기

권장일 2026-10-29 · 권장일이 지나도 제출은 그대로 받고, 늦었다는 표시도 하지 않습니다.

AI가 코드를 읽고 모든 확인 항목을 통과로 판정해야 진도에 반영됩니다. 판정을 확인할 수 없으면 통과로 처리하지 않으며, 실패가 아니라 확인 불가로 남겨 다시 검토를 요청할 수 있습니다.

AI 판정 설명 보기
단계 안내 · 20단계 따라 하기와 상세 프롬프트

목표: 정확한 패키지 버전의 OSV 조회 결과와 미조회·일부 실패를 구분합니다.

수정 대상: student/extension.mjs → renderVulnerabilities

idle / loading / error / ok를 구분하고 진행 중·오류 시 이전 표를 현재 결과처럼 남기지 않습니다.
data.status의 complete / partial / not_checked / not_configured / unverifiable을 원래 값과 한국어 설명으로 표시합니다.
전체 결과는 package-lock.json과 설치된 node_modules의 메타데이터를 대조한 값입니다. 전달된 경우에만 lockfileVersion·lockfileHash·checkedAt과 각 패키지의 name·정확한 version·status·source·checkedAt을 표시합니다. 행에 data-student-package-name과 data-student-package-version을 지정합니다.
취약점 항목의 id·modified를 표시합니다. 일부 조회 실패 시 이미 받은 취약점 ID는 유지합니다. none_found는 조회 범위에서 알려진 항목이 없다는 뜻으로 설명합니다.
직접 확인할 순서
package-lock.json에 기록된 버전과 표시 버전을 비교합니다. ^1.2.0 같은 버전 범위를 설치 버전으로 표시하지 않습니다.
취약점을 만들기 위해 의존성을 임의로 낮추지 않습니다. not_configured는 조회 대상 프로젝트 설정 필요, not_checked는 승인된 공개 조회 대상 없음 등의 미조회 상태로 구분합니다. 대상 경로나 허용 패키지는 운영자가 준비하며 학생이 임의로 설정을 변경하지 않습니다.

OSV는 알려진 취약점 데이터베이스입니다. 조회 결과가 없다는 사실만으로 해당 패키지나 앱 전체가 안전하다고 보장할 수 없습니다.

내 보안 Agent의 이름은 ‘나라찬’이고 지금은 20단계 ‘설치 패키지 버전과 알려진 취약점 조회 결과’를 진행해.
아래 공식 과제 안내를 먼저 읽고 현재 파일·함수·입력 계약과 대조해 줘. 안내에 없는 기능이나 제출 조건은 추가하지 마.
목표: 정확한 패키지 버전의 OSV 조회 결과와 미조회·일부 실패를 구분합니다.
수정 대상: student/extension.mjs → renderVulnerabilities

진행 방식:
1. 현재 구현을 읽고 유지할 기능, 수정할 함수, 입력 데이터, 확인할 상태를 먼저 설명해 줘. 파일이 없거나 계약이 다르면 추측해서 새 구조를 만들지 말고 차이를 알려 줘.
2. 아래 구현 순서에 따라 작은 단위로 수정해 줘. 각 수정 뒤 변경한 파일·함수와 이유를 짧게 설명하고, 내가 확인할 화면과 예상 결과를 알려 줘.
   1) idle / loading / error / ok를 구분하고 진행 중·오류 시 이전 표를 현재 결과처럼 남기지 않습니다.
   2) data.status의 complete / partial / not_checked / not_configured / unverifiable을 원래 값과 한국어 설명으로 표시합니다.
   3) 전체 결과는 package-lock.json과 설치된 node_modules의 메타데이터를 대조한 값입니다. 전달된 경우에만 lockfileVersion·lockfileHash·checkedAt과 각 패키지의 name·정확한 version·status·source·checkedAt을 표시합니다. 행에 data-student-package-name과 data-student-package-version을 지정합니다.
   4) 취약점 항목의 id·modified를 표시합니다. 일부 조회 실패 시 이미 받은 취약점 ID는 유지합니다. none_found는 조회 범위에서 알려진 항목이 없다는 뜻으로 설명합니다.
3. 상태 문구는 IT업계에서 쓰는 정확한 한국어로 작성해 줘. API 상태값·함수명·data-* 속성·필수 버튼 이름은 공식 계약대로 유지해. 의미를 바꾸는 의역이나 막연한 성공 안내는 쓰지 마.
4. 학생 화면을 구현하는 단계에서는 DOM을 createElement와 textContent로 작성하고, 색상뿐 아니라 텍스트로 상태를 구분해. 키보드로 조작할 수 있는 label과 버튼을 사용해. 문서 작성 단계에서는 불필요한 UI 변경을 하지 마.
5. 내가 직접 확인할 순서를 한 번에 하나씩 안내해 줘. 코드만 읽은 것, 모의 데이터로 점검한 것, 실제 화면에서 확인한 것을 구분하고 실행하지 않은 검사는 미확인으로 남겨.
   확인 1: package-lock.json에 기록된 버전과 표시 버전을 비교합니다. ^1.2.0 같은 버전 범위를 설치 버전으로 표시하지 않습니다.
   확인 2: 취약점을 만들기 위해 의존성을 임의로 낮추지 않습니다. not_configured는 조회 대상 프로젝트 설정 필요, not_checked는 승인된 공개 조회 대상 없음 등의 미조회 상태로 구분합니다. 대상 경로나 허용 패키지는 운영자가 준비하며 학생이 임의로 설정을 변경하지 않습니다.
현재 지원 범위: OSV는 알려진 취약점 데이터베이스입니다. 조회 결과가 없다는 사실만으로 해당 패키지나 앱 전체가 안전하다고 보장할 수 없습니다.

기존 학생 코드·앞 단계 기능·Git 기록을 지우거나 덮어쓰지 마. 제공 서버·public/app.js·판정 코드·인증 설정을 수정하지 마. 토큰·비밀번호·API 키를 요청하거나 출력하지 마.
수업용 AI가 명령을 실행할 수 없다면 실행했다고 말하지 말고 내가 PowerShell에서 실행할 명령과 작업 폴더를 알려 줘. 실제 유료 AI 요청·보안 조치·단계 제출은 임의로 실행하지 마.
끝나면 변경 파일, 직접 확인한 결과, 미확인 항목, 다음 작업을 정리해 줘. 커밋 해시나 통과 결과를 만들어 내지 마.

아래는 현재 단계 화면의 공식 과제 안내야. 위 보충 설명과 충돌하면 구현 전에 차이를 알려 줘.
목표: 프로젝트에 실제 설치된 패키지의 정확한 버전을 OSV 취약점 정보와 대조하고, 출처·확인 시각·실패를 구분해 보여 줍니다.

고칠 파일: renderVulnerabilities. 패키지를 바꾸기 전에 커밋합니다.

받는 값: renderVulnerabilities({ status, mode, data?, error? }). status 는 idle·loading·error·ok 입니다. - data.status(전체 조회 상태): complete(모두 조회) · partial(일부 조회 실패) · not_checked(아직 조회 안 함) · not_configured(프로젝트 설정 없음) · unverifiable(lock 파일 확인 불가) - data: lockfileVersion, lockfileHash, checkedAt, packages(설정·확인 불가일 때는 빈 배열) - packages: [{ name, version, status, vulnerabilities, source, checkedAt }], status: known_vulnerabilities · none_found · unverifiable

지금 알아 둘 것: - 서버는 프로젝트의 package-lock.json 과 담당자가 허용한 공개 패키지만 조회합니다. 허용 목록이 비어 있으면 not_configured·not_checked 가 나오는 것이 정상입니다. - 조회 실패와 미조회는 "취약점 없음"이 아닙니다. - 일부 조회에서 이미 받은 취약점 ID 는 지우지 않고 보여 줍니다. - ^1.2.0 같은 범위가 아니라 실제 설치 버전을 씁니다. 회사·비공개 패키지 이름을 밖으로 보내 확인하지 않습니다.

AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderVulnerabilities 를 구현해 줘. 앞 단계 함수는 그대로 둬. 입력은 { status, mode, data?, error? } 야. - status 가 idle 이면 아직 조회 전이라는 것, loading 이면 조회 중이라는 것, error 면 조회가 실패했다는 것과 message 를 보여 줘(예: "조회 전", "조회 중", "조회 실패: "). 오류·조회 중일 때 이전 표를 현재 결과처럼 남기지 마. - ok 면 data.status 를 원래 값과 함께 뜻을 글자로 보여 줘. 예: 모두 조회(complete), 일부 조회 실패(partial), 아직 조회 안 함(not_checked), 조회 준비 미완료(not_configured), lock 파일 확인 불가(unverifiable). - 전체 결과에 data.lockfileVersion, data.lockfileHash, data.checkedAt 을 함께 보여 줘. 패키지를 바꾼 뒤 다시 조회하면 새 lockfileHash 로 바뀌어야 해. - data.packages 의 각 행에 name, version(설치된 정확한 버전), status, source, checkedAt 을 보여 주고, 취약점마다 id 와 modified(수정 시각)를 함께 보여 줘. known_vulnerabilities=알려진 항목 있음, none_found=알려진 항목 없음, unverifiable=조회 확인 불가. unverifiable 인데 vulnerabilities 가 있으면 일부만 확인됐고 전체 조회는 확인할 수 없다는 것을 보여 주고(예: "일부 확인·전체 조회 확인 불가") 받은 ID 는 지우지 마. - 각 행 요소에 data-student-package-name 과 data-student-package-version 을 붙여. - 조회 실패를 "취약점 없음" 으로 보이게 하지 마. textContent 만 써.

스스로 확인: 1. 보호 현황의 설치 패키지 조회를 눌러 결과가 학생 칸에도 같은 값으로 보이는지 봅니다. 2. 조회 중 취소를 누르고 늦은 응답이 다시 나타나지 않는지 봅니다. 3. 오류 뒤 직접 다시 조회하면 새 요청이 나가는지 봅니다(네트워크 탭). 4. package-lock.json 의 버전과 화면의 버전이 같은지 한두 개 대조합니다.

필수 확인 항목: student-source-changed, exact_lock_version, osv_match, lookup_unavailable, no_results_distinction, partial_preservation, refresh_replaces, request_recovery, stale_response_blocked. 속성만 붙여서는 통과하지 않습니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.

다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.
20단계 상세 프롬프트 복사

공식 과제 안내
목표: 프로젝트에 실제 설치된 패키지의 정확한 버전을 OSV 취약점 정보와 대조하고, 출처·확인 시각·실패를 구분해 보여 줍니다.
고칠 파일: renderVulnerabilities. 패키지를 바꾸기 전에 커밋합니다.
받는 값: renderVulnerabilities({ status, mode, data?, error? }). status 는 idle·loading·error·ok 입니다. - data.status(전체 조회 상태): complete(모두 조회) · partial(일부 조회 실패) · not_checked(아직 조회 안 함) · not_configured(프로젝트 설정 없음) · unverifiable(lock 파일 확인 불가) - data: lockfileVersion, lockfileHash, checkedAt, packages(설정·확인 불가일 때는 빈 배열) - packages: [{ name, version, status, vulnerabilities, source, checkedAt }], status: known_vulnerabilities · none_found · unverifiable
지금 알아 둘 것: - 서버는 프로젝트의 package-lock.json 과 담당자가 허용한 공개 패키지만 조회합니다. 허용 목록이 비어 있으면 not_configured·not_checked 가 나오는 것이 정상입니다. - 조회 실패와 미조회는 "취약점 없음"이 아닙니다. - 일부 조회에서 이미 받은 취약점 ID 는 지우지 않고 보여 줍니다. - ^1.2.0 같은 범위가 아니라 실제 설치 버전을 씁니다. 회사·비공개 패키지 이름을 밖으로 보내 확인하지 않습니다.
AI 에게 붙여 넣을 프롬프트: student/extension.mjs 의 renderVulnerabilities 를 구현해 줘. 앞 단계 함수는 그대로 둬. 입력은 { status, mode, data?, error? } 야. - status 가 idle 이면 아직 조회 전이라는 것, loading 이면 조회 중이라는 것, error 면 조회가 실패했다는 것과 message 를 보여 줘(예: "조회 전", "조회 중", "조회 실패: "). 오류·조회 중일 때 이전 표를 현재 결과처럼 남기지 마. - ok 면 data.status 를 원래 값과 함께 뜻을 글자로 보여 줘. 예: 모두 조회(complete), 일부 조회 실패(partial), 아직 조회 안 함(not_checked), 조회 준비 미완료(not_configured), lock 파일 확인 불가(unverifiable). - 전체 결과에 data.lockfileVersion, data.lockfileHash, data.checkedAt 을 함께 보여 줘. 패키지를 바꾼 뒤 다시 조회하면 새 lockfileHash 로 바뀌어야 해. - data.packages 의 각 행에 name, version(설치된 정확한 버전), status, source, checkedAt 을 보여 주고, 취약점마다 id 와 modified(수정 시각)를 함께 보여 줘. known_vulnerabilities=알려진 항목 있음, none_found=알려진 항목 없음, unverifiable=조회 확인 불가. unverifiable 인데 vulnerabilities 가 있으면 일부만 확인됐고 전체 조회는 확인할 수 없다는 것을 보여 주고(예: "일부 확인·전체 조회 확인 불가") 받은 ID 는 지우지 마. - 각 행 요소에 data-student-package-name 과 data-student-package-version 을 붙여. - 조회 실패를 "취약점 없음" 으로 보이게 하지 마. textContent 만 써.
스스로 확인: 1. 보호 현황의 설치 패키지 조회를 눌러 결과가 학생 칸에도 같은 값으로 보이는지 봅니다. 2. 조회 중 취소를 누르고 늦은 응답이 다시 나타나지 않는지 봅니다. 3. 오류 뒤 직접 다시 조회하면 새 요청이 나가는지 봅니다(네트워크 탭). 4. package-lock.json 의 버전과 화면의 버전이 같은지 한두 개 대조합니다.
필수 확인 항목: student-source-changed, exact_lock_version, osv_match, lookup_unavailable, no_results_distinction, partial_preservation, refresh_replaces, request_recovery, stale_response_blocked. 속성만 붙여서는 통과하지 않습니다. AI가 제출한 커밋의 코드를 위 항목과 대조해 판정합니다. 실제 화면에서의 동작은 아래 안내에 따라 직접 확인합니다.
다음 단계 조건: AI가 이 단계의 필수 확인 항목을 모두 통과로 판정하면 서버에 통과와 진도를 기록합니다.

GitHub 저장소 주소와 확인받을 커밋(40자리)을 적어 제출합니다. 서버가 그 커밋의 코드를 그대로 받아 AI가 단계 과제 기준으로 꼼꼼히 읽고 확인합니다. 코드를 실행하지는 않습니다.

저장소 주소
커밋
비공개 저장소 원문 준비 방법
비공개 저장소 원문 묶음(JSON, 선택 사항)

로컬 도구에서 만든 원문 묶음을 선택하면 비공개 커밋도 확인할 수 있습니다. 원문 전달에 실패해도 제출 접수는 남습니다.

20단계 제출
