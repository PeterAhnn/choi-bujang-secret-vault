# BYTE BACK · 내 자료실

방어전 R5에서 시작한 공개 저장소이며 AI 과제와 별도로 관리한다. 실제 학생 자료와 비밀값을 넣지 않는다. 운영 서비스는 기존 전용 Supabase와 Vercel 자료실이다.

- 공개 자료실: https://choi-bujang-secret-vault-ochre.vercel.app/
- Git 원격: https://github.com/PeterAhnn/choi-bujang-secret-vault
- 현재 기능: 로그인 검증, 자기 메모 CRUD, 직접 DB 접근 차단, 기기·추가 확인·구역 판정, 사용자별 조회량 탐지, 검증된 정책 시험 복구, 비공개 한 건 메모 복구.

## 현재 공식 결과 · 2026-10-13

1~10단계와 XDR-01~06은 각각 공식100/100점이다. 8단계 통과 커밋은 f77c16a904373d0072d7e30e50eb8afae5e6fbe8, 9단계는36b7936a1829992c5837fd13a88586f652dd4747이다. 10단계579fa96ef800ff17ed1d1e39eaa6d5811a043aaf는 조건5개·가점3개·모든 공격 격파로100점이며11단계가 열렸다. 11~12단계 완료를 주장하지 않는다.

이전 단계의 상세 당시 기록은 [보존한 이력](docs/DEFENSE-HISTORY-BEFORE-STEP10.md)에 있다. 과거 미완료 문구와 현재 상태를 구분한다. 외부 문의는 보류한다.

## 10단계 실제 기능과 검증

원문: [전체 프롬프트](docs/DEFENSE-STEP-10-PROMPTS.md). 작업·실패·수정 근거: [실행 기록](docs/DEFENSE-STEP-10.md).

정책 안전 버전은 **f78dc936a3f76c309b76ee6cf7b4bed397abacdd**이다. 이 버전에서 B의 실제 정상 단건 조회·수정·삭제·복구를 확인했다. Git·SHA256 명세·Git 제외 사본6개를 다시 읽어 대조한다. 사본 누락·해시 실패면 중단한다. `node scripts/policy-recovery.mjs preview`로 버전·변경 파일·해시·미리보기ID를 먼저 표시하고, `apply 미리보기ID`는 확인한 시험 정책만 복구한다. 실제 운영 소스·다른 서비스·감사 이력은 보존한다. 이전9단계 사본도 Git 제외 별도 이름으로 보존했다.

복구 서비스는 기존 자료실의 **POST /api/restore**이고 본문은 `{"id":"메모 UUID"}`이다. 기존 로그인 검증 도우미가 확인한 소유자만 사용하며 입력 소유자·역할·추가 필드는 거부한다. 비공개 defense_note_backups에서 최초 INSERT 사본의 ID·소유자·내용 해시를 다시 대조해 한 건만 복원한다. 누락·잘못된 해시·타인·ID/소유자 충돌은 거부하고 다른 메모는 보존한다. defense_note_recovery_audit는 추가만 하며 원본 삭제 뒤에도 백업·감사를 보존한다. 응답은 id/restored/contentHash뿐이다. 서버 키는 기존 비밀 환경변수만 사용한다.

실제 B 로그인 화면에서 임시 가상 메모 추가→단건 조회→수정→복구→삭제→삭제 후404→복구를 실행했다. Vercel 기록의 GET200·PUT200·DELETE200·GET404·복구POST200과 DB의 ID·소유자·제목·내용·해시 일치를 대조했다. 임시 메모는 정리했고 원본4건의 전체 해시는 적용 전후 같다. 비공개 백업5건과 복구 감사5건은 시험 이력을 포함해 보존했다. 실제 학생 자료는 없다.

실제 DB 서비스 역할의 롤백 검사에서는 B 수정/삭제 복구·A의 B 복구 거부·소유자 충돌 거부·다른 메모/감사 보존과 사본 누락/잘못된 해시의 쓰기 전 중단을 확인했다. anon/authenticated는 원본·백업 직접 조회와 복구 RPC 실행을 할 수 없다. 기존 메모 RLS·서버 권한은 유지한다.

실제 단건 조회 회귀는 Vercel이 경로ID를 id 쿼리로 전달하는데 전체 쿼리 거부가 이를 막던 문제였다. 경로와 같은 단일id만 처리하며 다른ID·중복·추가 쿼리와 공지/기능 경로는 거부한다. 판정기·소유자 필터는 보존했다. 배포 식별은 Vercel 시스템 변수의 공개 운영 주소·실제 커밋·restoreRoute를 안내한다. 보호된 개별 배포 주소의 로그인 이동을 수정했으며 이를 공식 실패의 단독 원인이라고 단정하지 않는다.

## 복구 뒤 재시험 순서

1. `node scripts/policy-recovery.mjs preview`로 사본6개 재검증·시험 차이0을 확인한다.
2. `node --test test/step-03.test.mjs test/step-05.test.mjs test/step-08.test.mjs test/step-09.test.mjs test/step-10.test.mjs test/policy-recovery.test.mjs test/r5.test.mjs`를 실행한다. 현재25개 통과다. 정책 시험 API는 소유자 필터 제거 전후 A200/B200→복구 후 A200/B404를 확인하며 인증/DB 응답은 가상이다.
3. `npm run decider:test`와 `npm run detect:test`, `npm run build -- --local`을 실행한다. 현재 판정 연습4개·탐지 연습6개·빌드 통과다. 연습을 실제 운영 회수로 보고하지 않는다.
4. 공개 배포의 첫 화면·빈 data.json·현재 저장소/커밋/공개 운영 주소/복구 경로와 무로그인·위조 토큰 CRUD/복구 거부를 확인한다. 공개 키의 원본/백업/RPC 직접 호출도 거부돼야 한다.
5. B 실제 단건 CRUD·변조/삭제 후 복구와 원본 보존을 대조한다. 이 검증은 완료했다. A의 실제 UI 재시험은 이번 수정 후 미실행이며, A/B 처리기 회귀와 DB 타인 거부 검사를 구분한다. 최종 운영 공격과100점은 공식 심판에서 확인한다.

## 저장과 제출

키·토큰·실명·원본 메모 문장을 Git과 제출 묶음에 넣지 않는다. .local·.env·bundle-notes.json·artifacts/submission.json은 Git 제외다. 공개 파일에서 제거해도 과거 공개 이력이 사라진 것은 아니다.

변경 파일·비밀값 검사를 확인한 뒤 해당 단계 저장점으로 커밋하고 배포한다. 실제 공개 주소와 커밋을 대조한 뒤 깨끗한 Git에서 `npm run bundle`을 실행한다. 묶음 생성·자기 점검과 공식 판정은 구분한다. 현재 제출 화면의 배포 주소·저장소 주소·선택 설명으로 제출하고 공식100점 뒤 다음 개방 단계로 자동 진행한다.

서버 환경변수 이름은 SUPABASE_URL·SUPABASE_SECRET_KEY이며 값은 출력하지 않는다. 비밀 입력이 필요하면 공식 설정에서 처리하며 채팅으로 받지 않는다. 되돌릴 때 다른 변경·DB 자료를 보존하고 reset --hard를 쓰지 않는다.
