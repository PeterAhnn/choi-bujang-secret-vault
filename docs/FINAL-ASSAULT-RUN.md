# 나라찬 PC 관제 · 실행 안내

Windows에서 내 PC 자원·네트워크 구성·방화벽·Windows 기록을 읽어 봅니다. Node.js 22~24와 Windows PowerShell이 필요합니다. 확인 환경은 Node.js 24.21.0·Windows PowerShell 5.1입니다. 별도 npm 패키지 설치나 관리자 권한 상승은 필요하지 않습니다.

## 1. 같은 프로젝트에서 켜기

저장소 최상위 폴더에서 실행합니다. 이미 켜져 있으면 해당 주소를 열어 사용합니다. 포트가 사용 중이면 기존 앱을 종료하지 말고 아래 명령과 브라우저 주소의 포트를 함께 바꿉니다.

```powershell
Set-Location -LiteralPath '.\on-client'
node --version
npm run check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5189
```

`http://127.0.0.1:5189/`를 엽니다. 시작 화면에 **나라찬**이 보이면 **보호 현황**의 **나라찬 · PC 관제 대시보드**로 이동합니다. 계정 연결·AI 승인을 새로 시작할 필요는 없습니다. 포장 명령은 실행하지 않습니다.

## 2. 확인할 세 가지

1. **PC 상태 다시 조회**를 누릅니다. CPU·메모리·앱 디스크 여유에 실제 조회·출처 local-pc·측정 시각과 단위가 표시되는지 봅니다. CPU는 약 200ms 구간, 용량은 GiB입니다.
2. 네트워크 구성 수와 방화벽 세 프로필을 봅니다. 인터넷 접속 성공이나 SDP 허용 판정이 아닙니다. SDP 미연결 또는 확인 불가는 별도로 표시됩니다.
3. Windows 기록의 최근 24시간 경고·오류 건수와 최대 5,000건 범위를 봅니다. 상한 때문에 생략됐다면 그 안내가 표시됩니다. 건수는 침해 판정이 아닙니다.

두 번째 수동 조회 뒤 아래 **최근 수동 조회**에서 시각별 자원 값을 비교합니다. 최근 10회만 이 화면의 메모리에 남으며 새로고침하면 지워집니다. 표의 과거 값을 현재 정상값으로 해석하지 않습니다.

## 3. 실패·취소·키보드

- 읽지 못한 항목은 **확인 불가**와 이유로 표시됩니다. 0이나 예시 값으로 대체하지 않습니다. 0이 실제로 측정된 값인 경우에는 0을 그대로 표시합니다.
- 조회 중에는 대기 표시가 나오고 중복 전송을 막습니다. **PC 조회 취소**는 화면의 결과 수신을 취소하며 공유 GET 자체를 취소하는 기능은 아닙니다. 원래 요청이 끝난 뒤 **PC 상태 다시 조회**를 직접 누릅니다.
- Tab으로 버튼에 이동하고 Enter 또는 Space로 실행할 수 있습니다. 비활성 버튼은 Tab 순서에서 건너뜁니다.
- 일반 다시 불러오기로 앞 단계 화면이 갱신돼도 PC 패널과 이력은 유지됩니다. 브라우저 자체를 새로고침하면 학생 모듈과 이력은 초기화됩니다.
- 실행 창에서 Ctrl+C로 종료한 뒤 같은 명령으로 다시 켭니다. 다른 앱이나 다른 검증 포트의 프로세스를 일괄 종료하지 않습니다.

## 4. 다른 폴더에서 확인하기

원래 프로젝트는 그대로 두고 GitHub의 확인할 커밋을 새 폴더에 받습니다. 비밀 설정·개인 인증 보관소·인증서·.env는 복사하지 않습니다. 원래 폴더를 옮기거나 ZIP을 덮어쓰지 않습니다.

```powershell
git clone --no-checkout --config core.autocrlf=false https://github.com/PeterAhnn/choi-bujang-secret-vault.git .\narachan-review
Set-Location -LiteralPath '.\narachan-review'
$reviewCommit = Read-Host '확인할 40자리 커밋'
if ($reviewCommit -cnotmatch '^[0-9a-f]{40}$') { throw '40자리 소문자 커밋을 확인하세요.' }
git checkout --detach $reviewCommit
if ($LASTEXITCODE -ne 0) { throw '커밋을 가져오지 못했습니다.' }
git rev-parse HEAD
Set-Location -LiteralPath '.\on-client'
npm run check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5197
```

`http://127.0.0.1:5197/`에서 같은 순서로 확인합니다. 다른 사람이 실제로 사용하지 않았다면 그 검사는 미실시로 기록합니다. AI가 수행한 별도 폴더 재현을 다른 사람이나 본인의 직접 실행으로 바꿔 쓰지 않습니다.

실제 SDP·사건 설명·조치 집행·외부 OSV 성공의 미확인 범위와 과거 공식 통과는 [총공세 기록](FINAL-ASSAULT.md)과 [22단계 인수인계](STUDENT_HANDOFF.md)를 함께 봅니다.
