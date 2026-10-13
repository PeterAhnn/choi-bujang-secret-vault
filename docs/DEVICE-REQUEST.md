# 자료실 기기 요청 규격 v1

이 규격은 이 자료실의 실제 서버 검증 규격이다. ALEPH 엔진의 공식18필드 계약에 새 필드를 추가하지 않는다. 공개 시작 틀은 등록 URL·서명 알고리즘·직렬화 형식을 지정하지 않으므로 여기에서 구현한 형식과 공식 계약을 구분한다.

## 승인과 보관

POST /api/device/request는 검증된 로그인 사용자와 공개 P-256 JWK 네 필드(crv/kty/x/y)만 등록한다. 새 행은 pending이다. GET /api/device/status?id=기기ID는 실제 DB 상태·공개 지문만 반환한다. 요청 버튼은 승인 권한이 없고 서버 역할도 status INSERT/UPDATE를 할 수 없다. 본인이 실제 요청 지문을 검토한 뒤 관리 권한으로만 승인한다. 요청·상태 변경은 추가 전용 감사에 남긴다.

개인키는 WebCrypto의 추출 불가 키로 현재 화면 메모리에만 두고, 토큰도 Supabase SDK의 persistSession:false로 메모리에서만 사용한다. 이전 앱의 저장된 세션은 값의 내용은 읽지 않고 해당 항목만 제거한다. localStorage/sessionStorage/IndexedDB/CacheStorage에 키·토큰을 쓰지 않는다. 화면을 다시 열면 새 키와 재승인이 필요하다. 설치·PWA 표시를 하드웨어 증명이나 서버 승인으로 취급하지 않는다.

승인 기기 키는 이 자료실에서 전역으로 확인한다. 사용자마다 정상 JWT와 해당 사용자에 묶인 서명이 별도로 필요하고, 원래 메모 소유자 검사는 그대로 적용된다. requested_by는 감사의 요청자이며 접근 역할을 부여하는 값이 아니다.

## 요청 서명

기기 ID는 {crv:'P-256',kty:'EC',x,y} 순서의 JSON을 SHA256으로 계산한 지문의 앞16자리 소문자 hex다. 공개 지문은64자리다.

보호 메모·복구 요청에는 x-device-id, x-device-time(UTC epoch 초), x-device-nonce(임의24바이트의base64url32자), x-device-signature(P-256/SHA256 raw64바이트의base64url86자)가 필요하다.

서명 문자열은 아래8개 값을 LF로 연결한다. 마지막 LF는 없다.

```
DEFENSE-DEVICE-V1
검증된 로그인 사용자 UUID
기기 ID
대문자 HTTP 메서드
경로와 쿼리
UTC epoch 초
nonce
본문 SHA256 소문자 hex
```

본문은 JSON 객체 키를 재귀적으로 정렬한 JSON이며 본문이 없으면 빈 문자열이다. 서명과 실제 전송에 같은 직렬화를 사용한다. Vercel이 붙이는 경로와 같은 단일id 쿼리만 정규화하며 다른ID·중복·추가 쿼리는 바꾸지 않는다. 외부 출처 경로는 거부한다.

서버는 원본 로그인 도우미 검증→실제 DB approved 조회→공개키 지문/실제 서명 검증→±60초 검사와 DB의nonce단일사용→기존API 순서로 확인한다. nonce RPC도 승인 상태를 다시 확인하며 재사용은false다. 서명 누락·경로/본문/사용자 변경·미승인·재전송은 기존 API에 도달하지 않는다. 요청 원문·토큰·개인키는 로그나 감사에 넣지 않는다.

자료실 기본 API 진입점에 이 검증을 직접 연결한다. 기존 ALEPH 판정기의 deviceRegistered 규칙은 유지한다. 새 DB 등록이 운영 반 엔진으로 전달된다고 주장하지 않는다. 정상/공격의 실제 배포 검사와 공식 심판 결과를 별도로 확인한다.
