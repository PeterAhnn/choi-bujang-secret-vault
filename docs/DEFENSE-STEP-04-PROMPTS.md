# 4단계 공식 프롬프트 원문

출처: https://aleph-omega.vercel.app/defense 로그인된4단계 창. 확인일:2026-10-06 한국 시간. 입력 칸과 확인 문구를 보존하며 실행 결과는 별도 기록한다.

## 이어받기

이 폴더는 1~3단계까지 만든 같은 자료실이야. 이번에는 4단계 「로그인해도 내 자료만 보이게 합니다」를 할 거야. AGENTS.md와 README.md, 폴더 구조, git 상태, git log -1을 읽고 README의 단계 기록이 마지막 커밋과 맞는지 대조해 줘. 어긋나면 먼저 알려 줘. 현재 기능을 다섯 줄 이내로 요약하고 다른 작업은 보존해. 아직 아무 파일도 고치지 마.

## 만들기 1: 제작 1

기존 가상 메모 세 개에 A의 owner_id를 연결하고 B 소유의 공개 가능한 시험 메모 한 건을 준비하는 학습용 SQL만 제안해 줘. A의 이메일은 [ ], B의 이메일은 [ ] 야. 이메일로 auth.users에서 ID를 찾는 SQL로 만들어 줘. 아직 API와 권한 정책은 바꾸지 마.

확인: SQL 적용 뒤 A의 세 메모와 B의 한 메모에 각각 올바른 소유자 ID가 있어야 합니다.

## 만들기 2: 제작 2

메모 읽기·추가·수정·삭제 API에서 검증된 사용자 ID와 DB의 owner_id를 비교해 줘. URL·본문의 owner_id를 믿지 말고 추가할 때는 확인된 ID로 저장해. 수정에서는 기존 행과 새 행의 소유자가 모두 본인인지 확인하고, 삭제도 본인 것만 허용해. 한 건 응답은 {id,title,body}, 수정 본문은 {title,body}를 유지해. 실제 GET·POST·PUT·DELETE 메서드와 경로를 aleph.config.json의 allowedRoutes에 적어 줘. 이번에는 API의 소유자 검사만 바꾸고 DB 권한 SQL은 다음 요청으로 남겨 줘.

확인: A/B는 자기 메모 읽기·추가·수정·삭제를 유지하고 상대 메모 접근과 소유자 변경은 거부되어야 합니다.

## 만들기 3: 제작 3

학습 DB의 메모 테이블에 RLS와 최소 권한 SQL을 제안해 줘. 기존 권한부터 REVOKE ALL ON TABLE … FROM PUBLIC, anon, authenticated로 회수한 뒤 authenticated에 SELECT·INSERT·UPDATE·DELETE를 GRANT해. SELECT·DELETE는 기존 행 USING, INSERT는 새 행 WITH CHECK, UPDATE는 기존 행 USING과 새 행 WITH CHECK로 모두 auth.uid()=owner_id일 때만 허용해. 다른 테이블은 건드리지 마. 적용 전후 information_schema.role_table_grants와 has_table_privilege로 두 역할의 실제 권한을 대조해 줘. SQL은 내가 검토해 실행할게.

확인: anon에는 권한이 없고 authenticated에는 SELECT·INSERT·UPDATE·DELETE만 남아야 합니다. 앱 API에서 A/B 각자 자기 행은 허용되고 상대 행은 거부되어야 합니다.

## 제출 전 확인

이번 변경을 「4단계 저장점」으로 커밋해 줘. 그다음 npm run bundle을 실행해 제출 묶음 JSON과 요약을 보여 줘. 오류가 나면 첫 오류만 고쳐 줘.

## 막혔을 때 넣을 프롬프트

4단계 「로그인해도 내 자료만 보이게 합니다」에서 [제작 번호]를 실행했는데 기대와 달라. 기대한 결과: [ ]. 실제 화면/첫 오류: [ ]. 비밀값을 지운 뒤 원인 후보를 두세 개 적고, 가장 가능성 높은 하나만 최소한으로 고쳐 줘. 다른 기능은 건드리지 마. 수정 뒤 직접 확인할 방법을 알려 줘.

## 되돌려야 할 때

4단계 변경 때문에 동작이 깨졌어. 먼저 git status와 diff로 이번 단계 변경과 다른 변경을 구분하고, 사라질 내용을 보여 줘. 다른 변경과 DB 자료는 보존해. 직전 작동 커밋으로 이번 단계 파일만 안전하게 되돌리는 방법을 제시하고, 확인받은 뒤 실행해 줘. reset --hard는 쓰지 마.
