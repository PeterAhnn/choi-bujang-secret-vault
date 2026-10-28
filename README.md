# BYTE BACK · 개인 자료실과 보안 Agent

로그인한 사용자가 자기 메모를 관리하고, 계정·기기·접속 상태를 확인하는 보안 학습 프로젝트입니다. 웹 자료실의 접근 제어와 복구 기능에서 시작해 로컬 보안 대시보드까지 확장했습니다.

[웹 자료실](https://choi-bujang-secret-vault-ochre.vercel.app/) · [보안 Agent 구현](on-client/student/extension.mjs)

## 주요 기능

**웹 자료실**

- 로그인과 메모 소유자를 서버에서 확인하고, 본인 메모만 조회·수정·삭제합니다.
- 승인된 기기의 요청 서명을 검증하고, 변조·재전송 요청을 거부합니다.
- 비공개 백업을 대조해 메모 한 건을 복구하고 감사 이력을 남깁니다.
- 작전실에서 접근 규칙, 기기 승인 상태, 백업·복구 현황을 확인합니다.

**로컬 보안 Agent**

| 기능 | 구현 내용 | 기록 |
|---|---|---|
| 계정·기기·세션 | 현재 사용자와 상태를 표시하고, 재조회 결과로 화면을 교체합니다. | [13단계](docs/DEFENSE-STEP-13.md) |
| 업무 앱 접근 판정 | 허용·거부·추가 확인·확인 불가와 요청 실패를 구분합니다. | [14단계](docs/DEFENSE-STEP-14.md) |
| 접속·XDR 기록 | 최신순 목록, 세 가지 필터, 근거·규칙·상태 상세를 제공합니다. | [15단계](docs/DEFENSE-STEP-15.md) |
| 상태·알림·도움정보 | 빈 목록·오류·시간 초과를 구분하고, 지정된 진단값만 복사합니다. | [16단계](docs/DEFENSE-STEP-16.md) |
| AI 연결 상태 | 계정 연결·앱 승인·모델 목록 점검과 사건 설명 결과를 구분합니다. | [17단계](docs/DEFENSE-STEP-17.md) |
| 근거에 연결된 AI 설명 | 선택한 사건의 근거·규칙·확인 불가 상태와 미실행 제안을 표시합니다. | [18단계](docs/DEFENSE-STEP-18.md) |
| 조치 상태 표시 | 준비·전송·접수·효과 관측을 구분합니다. 실제 집행 연결은 대기 중입니다. | [19단계](docs/DEFENSE-STEP-19.md) |

## 코드 구성

| 경로 | 역할 |
|---|---|
| `public/` | 웹 자료실 화면과 기기 서명 요청 |
| `api/`, `src/` | 인증·소유자 검증, 메모 API, 복구, 판정·탐지 규칙 |
| `on-client/student/extension.mjs` | 보안 Agent의 학생 구현 영역 |
| `docs/`, `evidence/` | 단계별 설계·검증 기록과 가린 요청 결과 |

웹 자료실은 JavaScript, Supabase, Vercel을 사용합니다. 보안 Agent는 Node.js와 브라우저 DOM API를 사용하며, 공식 ALEPH 시작 틀의 서버·공통 UI와 직접 작성한 학생 표시 코드를 구분합니다.

## 보안 Agent 실행

Node.js 24와 PowerShell을 사용합니다. 공식 기준 버전은 24.19.0이며, 예제 실행에 추가 npm 패키지는 필요하지 않습니다.

```powershell
git clone https://github.com/PeterAhnn/choi-bujang-secret-vault.git
Set-Location choi-bujang-secret-vault/on-client
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Demo -Port 5189
```

브라우저에서 [http://127.0.0.1:5189/](http://127.0.0.1:5189/)를 엽니다. 예제 모드는 실제 계정 연결 없이 화면을 둘러보는 용도입니다. 자세한 실행·종료 방법은 [공식 실행 안내](on-client/docs/STUDENT_LAUNCH_GUIDE.md)를 참고하세요.

## 검증과 현재 범위

- 13~19단계 제출 코드는 공식 원문 검토를 통과했습니다. [19단계 판정 기록](verification/stage19/official-review-20261028.json)은 필수 8개 항목 전체 통과입니다. 별도로 예제 API 응답, 모의 상태 전환, 키보드 조작, 오류 복구와 복사값 범위를 확인했습니다. 실제 조치 집행·효과 관측·결과 재조회는 원천 시스템 미연결로 기다림(UNV)입니다.
- 웹 자료실은 가상 메모로 소유자 검증·서명·복구를 검사했습니다. 상세 절차는 [HTTP 검증 기록](docs/HTTP-VERIFICATION.md)에 있습니다.
- 시작 틀은 0.2.21입니다. 실제 계정 연결·AI 앱 승인과 모델 목록 점검(`verified`, 모델 1개)을 확인했습니다. [17단계 공식 코드 검토](verification/stage17/official-review-20261028.json)는 9개 항목 모두 통과했습니다. 실제 사건 설명은 SDP 원천 기록이 연결되지 않아 실행하지 않았습니다.

실제 학생 자료와 비밀번호·토큰·서버 키는 저장소에 넣지 않습니다.
