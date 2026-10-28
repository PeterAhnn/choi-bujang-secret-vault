# 20단계 검증

기준 커밋은 `a5b77e06db211724215ec57b036b814bee1ca482`입니다.

```powershell
node verification/stage20/check.mjs
node verification/stage20/preview.mjs --port=5190
```

독립 검사 68개를 통과했습니다. renderVulnerabilities 이외 원문 보존, 현재 입력의 버전·출처·시각·부분 결과와 표 교체를 확인합니다. 제공 요청 함수의 실제 본문을 격리 실행한 취소·복구 검사는 합성 응답을 사용하며 외부 통신을 하지 않습니다. 보관본은 contract-results.json입니다.

preview.mjs는 별도 모의 화면입니다. 잠금 파일의 공개 패키지 좌표를 사용하더라도 OSV 응답은 합성 자료이며 실제 조회로 기록하지 않습니다. 실제 앱의 미설정 결과와 시각은 browser-regression.json에 분리합니다. 운영자 조회 설정과 의존성은 변경하지 않습니다.

installed-metadata-comparison.json은 선택한 공개 패키지 두 개의 실제 설치 메타데이터와 잠금 파일을 읽기 전용으로 대조한 결과입니다. 두 버전 모두 일치하며 OSV 조회를 실행한 기록이 아닙니다.

## 공식 코드 검토

제출 커밋 `49135e480beada4c9248430adc100e56a1b2cdde`는 2026-10-28 10:19에 접수됐으며 필수 9개 항목 모두 통과했습니다. 표시 시각 10:20의 원문 피드백을 [official-review-20261028.json](official-review-20261028.json)에 보관했습니다. 실제 외부 OSV 조회 성공은 확인하지 않았으며 실제 앱의 결과는 not_configured입니다. 통과 후 재제출하지 않았습니다.
