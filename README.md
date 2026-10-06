# BYTE BACK · 내 자료실

본인 공개 저장소에서 만든 **방어전 R5 시작 틀**을 이어 사용합니다. 공식 진행 사이트: https://aleph-omega.vercel.app/defense . AI 과제와 다른 단계 창·심판 절차를 따릅니다.

## 단계 기록과 현재 기능

- 1단계: 초기 커밋 `a06a96e5c0953d00ed2ce797d84daf75f22cdbc4`. 가상 자료 공개와 배포 식별 파일을 확인했고, 2026-10-06 포털의 `막아 냈습니다` 판정을 확인했습니다. 1단계는 배포 주소 하나만 제출하며 설정 편집·bundle을 요구하지 않습니다.
- 2단계: 자료를 코드 밖으로 옮깁니다. DB 적용·배포 검증·심판 판정은 [단계 기록](docs/DEFENSE-STEP-02.md)에서 구분합니다.
- `/`: 서버 API에서 학습용 가상 카드 네 개를 불러오는 화면. 오류·빈 상태도 표시합니다.
- `/api/notes`: 서버의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`로 DB를 읽고 표시 필드만 반환합니다. 키·DB 오류 원문을 응답·로그에 넣지 않습니다. **아직 로그인 보호가 없어 이 API는 공개입니다.**
- `/data.json`: 메모 0건. 빌드는 정적 메모 복사를 중단하며 소스에 메모가 남으면 실패합니다. `/aleph.json`은 Vercel 시스템 변수의 실제 저장소·커밋·배포 주소로 자동 생성합니다.

실제 학생 자료·개인정보·비밀값을 넣지 마세요. 최신 파일에서 메모를 제거해도 **옛 공개 커밋·옛 배포·외부 복사본은 없어지지 않습니다.** DB 이동을 과거 노출 해소나 로그인 보호 완료로 보고하지 않습니다.

## DB와 서버 설정

[구조 SQL](database/step-02-schema.sql)은 `defense_notes`에 `owner_id uuid` 칸을 두며 `auth.users` 외래키가 없습니다. RLS를 켜고 `PUBLIC`·`anon`·`authenticated` 권한을 철회합니다. 서버 역할에는 SELECT만 줍니다. 클라이언트 읽기 정책은 없습니다.

네 가상 메모를 옮기는 SQL 한 파일은 `.local/step-02-migrate.sql`에 있으며 Git·공개 배포에서 제외됩니다. 대상 DB를 확인한 뒤 적용합니다. 이 파일과 `.local/sample-notes.json`은 메모 본문이 있으므로 커밋하지 않습니다. 행 수, owner_id 칸, 외래키 없음, RLS, anon·authenticated SELECT 거부를 실제 DB에서 확인합니다.

Vercel 공식 프로젝트 Settings → Environment Variables에서 학생이 직접 설정합니다. **키 값은 채팅으로 보내지 마세요.**

| 이름 | 값의 종류 |
|---|---|
| `SUPABASE_URL` | 대상 DB 프로젝트의 HTTPS API 주소 |
| `SUPABASE_SECRET_KEY` | 해당 프로젝트의 서버 전용 secret 키. 공개 키와 구분. |

설정 후 새 배포가 필요합니다. 환경변수를 설정하지 않은 서버는 503을 반환합니다.

## 다시 실행하기

```powershell
npm ci
npm run test:r5
node --test test/step-02.test.mjs
npm run build -- --local
```

로컬 빌드는 정적 결과물 확인이며 DB 조회·Vercel 배포·심판 접수의 증거가 아닙니다. 실제 배포 빌드에는 Vercel의 Git·커밋·배포 시스템 변수가 필요합니다. 배포 식별 파일을 임의 커밋으로 수동 작성하지 않습니다.

## 최신 파일 검색과 배포 확인

메모 문장을 README·테스트·공개 SQL에 다시 적지 않습니다. `.local/sample-notes.json`의 원본 네 메모 `content`를 검색값으로 사용하며, 일치한 본문 대신 경로만 확인합니다.

```powershell
$sampleData = Get-Content .local/sample-notes.json -Raw | ConvertFrom-Json
foreach ($sample in $sampleData.notes) {
  git grep -l -F -- $sample.content
  rg -l -F -- $sample.content public
}
```

둘 다 파일 경로가 없어야 통과합니다. 커밋 후 각 검색값에 `git grep -l -F -e $sample.content HEAD --`를 실행해 최신 커밋도 확인하고, 로컬 HEAD와 실제 GitHub 원격 main을 대조합니다. 과거 전체 이력을 제거했다는 검사가 아닙니다.

로그인과 쿠키 없이 배포 주소를 확인합니다.

1. `/`: 200·네 카드·`X-Content-Type-Options: nosniff`.
2. `/data.json`: 404 또는 메모 0건.
3. `/aleph.json`: 200·step 2·본인 저장소와 실제 소스 커밋 일치.
4. `/api/notes`: 200·가상 메모 네 건. 이 API가 공개라는 남은 약점도 기록.
5. Supabase 공개 키의 테이블 읽기: 자료 읽기 거부. 키 값은 기록하지 않음. 학생 검사와 운영 심판의 공개 키 검사를 구분.

배포 HTML·공개 정적 JSON에도 원본 메모 문장이 없어야 합니다. DB 조회 API 응답은 정적 번들과 구분합니다. 실제 검색 결과와 남은 약점은 단계 기록에 남깁니다.

## 2단계 저장점과 제출

step·실제 Git 원격·공개 배포 주소를 구현과 맞추고, 포함 파일·메모 원문·비밀값 검사를 확인한 뒤 `2단계 저장점`으로 커밋합니다. `judgeIssuer`는 시작 틀의 운영 주소를 보존합니다. 3단계 인증·허용 경로, 5단계 원본 API는 지금 채우지 않습니다.

ignored `bundle-notes.json`에는 실제 변경 설명과 남은 문제만 적습니다. `.local`, `.env`, `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않습니다. 깨끗한 Git 상태에서 다음 명령을 실행합니다.

```powershell
npm run bundle
```

마지막 커밋의 설정과 실제 요청 결과로 `artifacts/submission.json`을 생성합니다. 키·메모 본문은 묶음에서 제외합니다. 생성 성공은 방어 성공이나 운영 심판 판정이 아닙니다. 현재 팝업 제출란은 공개 배포 주소와 선택 설명만 받습니다. 운영 심판 결과는 포털에서 확인합니다.

이번에 기존 판정·탐지·AI·위협정보·XDR 연습 코드는 변경하지 않습니다. 로컬 연습 성공을 운영 엔진 연결로 보고하지 않습니다. 오류는 첫 오류와 이번 변경을 근거로 최소 한 가지씩 수정합니다. 되돌릴 때 다른 변경·DB 자료를 보존하며 `git reset --hard`를 쓰지 않습니다.
