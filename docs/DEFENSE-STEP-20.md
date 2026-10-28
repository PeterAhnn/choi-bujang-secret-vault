# 20단계 · 사용 라이브러리와 취약점 정보 대조

확인일: 2026-10-28 (한국 시간)
출처: https://aleph-omega.vercel.app/defense 의 열린 20단계 상세 안내와 공식 과제 안내. [원문](DEFENSE-STEP-20-PROMPTS.md)은 화면에서 직접 읽어 보관했다.

## 범위

기존 Codex 저장소의 `a5b77e06db211724215ec57b036b814bee1ca482`를 기준으로 `on-client/student/extension.mjs`의 renderVulnerabilities만 구현했다. 시작 틀 0.2.21과 13~19단계 함수·제공 파일·인증 설정·Git 이력·기존 사용자 사본을 보존한다. 패키지 버전과 운영자 조회 설정을 변경하지 않는다.

## 구현

- idle·loading·error·ok를 구분하고 각 호출마다 새 DOM을 반환해 이전 표를 교체한다. 오류 코드·안내, 취소와 수동 다시 조회를 표시한다. 학생 함수에는 요청·자동 재시도·취소 처리를 추가하지 않는다.
- complete·partial·not_checked·not_configured·unverifiable의 뜻과 원래 값을 표시한다. 미조회·설정 없음·확인 불가를 취약점 없음으로 해석하지 않는다.
- 받은 범위에서 lockfileVersion·lockfileHash·checkedAt, 각 패키지의 name·정확한 version·status·source·checkedAt을 표시한다. 각 행의 data-student-package-name·data-student-package-version은 그 행의 실제 입력값이다.
- 취약점의 id·modified를 표시한다. unverifiable 행에 이미 받은 ID가 있으면 부분 확인임을 밝히고 지우지 않는다. none_found는 해당 버전의 조회 범위에서 알려진 항목이 없다는 뜻이며 앱의 안전을 보장하지 않는다.

## 검증

- 문법 검사와 독립 검사 68개를 통과했다. 기준 stub은 29개 항목에서 실패해 미구현을 탐지했다. 13~19 함수 및 대상 함수 밖 원문 보존, 새 해시·목록 교체, 오류·취소 뒤 이전 표 제거, 부분 결과 보존을 확인했다.
- 제공 public/app.js의 실제 clearVulnerabilities·cancelVulnerabilities·loadVulnerabilities 본문을 수정 없이 격리 실행했다. 합성 지연 응답으로 오류 뒤 새 요청, 취소 뒤 늦은 응답 폐기, 이전 요청 폐기와 초기화를 확인했다. 합성 요청 5회이며 실제 네트워크 요청은 없다.
- 실제 앱 http://127.0.0.1:5189/ 에서 두 번 수동 조회했다. 제공 영역과 학생 영역은 같은 조회 시각의 not_configured를 표시했다. 두 번째 조회 시각은 새 값으로 바뀌었다. 패키지 행은 0개였다.
- 선택한 공개 패키지 두 개의 실제 설치 메타데이터와 잠금 파일 버전을 읽기 전용으로 대조했다. @supabase/supabase-js 2.117.2와 jose 6.2.12가 각각 일치했다. 이 대조는 OSV 조회 결과가 아니며 installed-metadata-comparison.json에 보관했다.
- 별도 모의 브라우저에서 전체 조회 5상태, partial의 받은 취약점 ID 보존, 새 결과 B의 새 해시·1개 행 교체, 취소·초기화 뒤 이전 행 제거를 확인했다. 모의 취약점과 해시를 실제 OSV 응답으로 기록하지 않는다.
- 실제 OSV 조회·설치 버전의 결과 화면 대조·실제 지연 응답 취소는 미확인이다. 운영자 설정이 없고 응답이 즉시 반환되므로 별도 합성 검사와 구분한다. 의존성을 낮추거나 운영자 허용 목록을 바꾸지 않았다.

## 직접 확인과 공식 판정

사용자는 별도 모의 화면에서 두 공개 패키지의 잠금 파일 버전과 학생 표시가 일치한다고 직접 확인했다. 이어 not_configured·not_checked가 서로 구분되고 안전하다고 표시하지 않는 것도 직접 확인했다. 합성 OSV 결과는 실제 조회 결과가 아니다. 이번 단계 파일만 커밋·push한 뒤 공식 코드 검토에 제출한다. 접수 후 판정 대기는 최대 5분이며 통과한 제출은 반복하지 않는다.
