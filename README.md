# BYTE BACK · 개인 자료실과 보안 Agent

로그인한 사용자가 자기 메모를 관리하고, 계정·기기·접속 상태를 확인하는 보안 학습 프로젝트입니다. 웹 자료실의 접근 제어와 복구 기능에서 시작해 로컬 보안 대시보드까지 확장했습니다.

[웹 자료실](https://choi-bujang-secret-vault-ochre.vercel.app/) · [보안 Agent 구현](on-client/student/extension.mjs)

## 나라찬 PC 관제 대시보드

보호 현황에서 CPU·메모리·앱 디스크 여유, 네트워크·방화벽과 최근 Windows 기록을 읽어 봅니다. 제공된 읽기 전용 수집기를 활용하고, 학생 영역에 측정 시각·단위·실패 이유와 최근 수동 조회 10회 비교를 추가했습니다. PC 실측과 SDP 연결 상태를 구분하며 Windows 경고·오류 건수를 침해 판정으로 표현하지 않습니다.

[실행 안내](docs/FINAL-ASSAULT-RUN.md) · [세 기능 시연과 한계](docs/FINAL-ASSAULT-DEMO.md) · [구현·검증 기록](docs/FINAL-ASSAULT.md)

마지막 총공세 마무리 자료는 커밋 `af6da0ccd128071ea137831a632671c95352e2d8`로 접수했습니다. 현재는 **강사 확인 대기**이며 승인·채점 완료와 구분합니다. [접수 기록](verification/final-assault/final-submission-receipt.json)을 보관했습니다.

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
| 설치 패키지 조회 표시 | 정확한 버전·OSV 출처·시각과 부분 실패·미조회 상태를 구분합니다. | [20단계](docs/DEFENSE-STEP-20.md) |

## 코드 구성

| 경로 | 역할 |
|---|---|
| `public/` | 웹 자료실 화면과 기기 서명 요청 |
| `api/`, `src/` | 인증·소유자 검증, 메모 API, 복구, 판정·탐지 규칙 |
| `on-client/student/extension.mjs` | 보안 Agent의 학생 구현 영역 |
| `docs/`, `evidence/` | 단계별 설계·검증 기록과 가린 요청 결과 |

웹 자료실은 JavaScript, Supabase, Vercel을 사용합니다. 보안 Agent는 Node.js와 브라우저 DOM API를 사용하며, 공식 ALEPH 시작 틀의 서버·공통 UI와 직접 작성한 학생 표시 코드를 구분합니다.

## 보안 Agent 실행

Windows에서 Node.js 22~24와 PowerShell을 사용합니다. 수업 기준은 24.19.0이며, 이번에는 Windows 11·Node.js 24.21.0·Windows PowerShell 5.1에서 실행을 확인했습니다. 예제 실행에 추가 npm 패키지는 필요하지 않습니다.

```powershell
git clone https://github.com/PeterAhnn/choi-bujang-secret-vault.git
Set-Location choi-bujang-secret-vault/on-client
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Demo -Port 5189
```

브라우저에서 [http://127.0.0.1:5189/](http://127.0.0.1:5189/)를 엽니다. 예제 모드는 실제 계정 연결 없이 화면을 둘러보는 용도입니다. 기존 앱을 유지하며 다른 포트로 확인하는 방법, 종료·재실행, 구성도와 오류별 절차는 [학생 실행 설명서](docs/STUDENT_RUNBOOK.md)에 정리했습니다. [공식 실행 안내](on-client/docs/STUDENT_LAUNCH_GUIDE.md)도 함께 참고하세요.

22단계 당시의 커밋 고정·재현 기록·데이터 보존 계획은 [인수인계 문서](docs/STUDENT_HANDOFF.md)에 있습니다. 이후 PC 관제 표시를 추가한 학생 버전은 **검증 중 r22.2**이며 [총공세 기록](docs/FINAL-ASSAULT.md)에서 구분합니다. 실제 집행과 외부 연결의 미확인 범위가 남아 있어 운영 인증이나 v1.0으로 표시하지 않습니다.

## 검증과 현재 범위

- 13~22단계 제출물은 공식 원문 검토를 통과했습니다. [22단계 판정 기록](verification/stage22/official-review-20261028.json)은 인수인계·재현 문서에 관한 필수 6개 항목 전체 통과입니다. 통과 커밋은 [3ea41ad](https://github.com/PeterAhnn/choi-bujang-secret-vault/commit/3ea41ade885402a49f7e5f2cdc5ef44171ef106d)입니다. 해당 커밋을 새 폴더에 받아 예제 실행·종료·재실행과 Git 코드 백업·복원을 확인했습니다. [최종 재현 기록](verification/stage22/final-reproduction.json)에 실행 범위를 남겼습니다.
- 별도로 예제 API 응답, 모의 상태 전환, 키보드 조작, 오류 복구와 복사값 범위를 확인했습니다. 실제 조치 집행·효과 관측·결과 재조회는 원천 시스템 미연결로 기다림(UNV)이며, 실제 OSV 조회 성공은 프로젝트 설정이 없어 미확인입니다. 공식 원문 검토는 실운영 인증과 다릅니다.
- 웹 자료실은 가상 메모로 소유자 검증·서명·복구를 검사했습니다. 상세 절차는 [HTTP 검증 기록](docs/HTTP-VERIFICATION.md)에 있습니다.
- 시작 틀은 0.2.21입니다. 실제 계정 연결·AI 앱 승인과 모델 목록 점검(`verified`, 모델 1개)을 확인했습니다. [17단계 공식 코드 검토](verification/stage17/official-review-20261028.json)는 9개 항목 모두 통과했습니다. 실제 사건 설명은 SDP 원천 기록이 연결되지 않아 실행하지 않았습니다.

실제 학생 자료와 비밀번호·토큰·서버 키는 저장소에 넣지 않습니다.
