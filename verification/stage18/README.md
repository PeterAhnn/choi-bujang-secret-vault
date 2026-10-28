# 18단계 검증

프로젝트 루트에서 실행합니다.

```powershell
node verification/stage18/check.mjs
node verification/stage18/preview.mjs
```

첫 명령은 모의 DOM으로 계약의 상태 전환·근거 결속·성공 속성 제거와 이전 함수 보존을 검사합니다. 결과는 기본적으로 임시 폴더에 생성하며 보관한 결과는 contract-results.json입니다. 52개 항목을 통과했습니다.

두 번째 명령은 http://127.0.0.1:5190/ 에 별도 모의 화면을 엽니다. 실제 학생 함수를 불러오지만 입력은 합성 자료입니다. 실제 계정·AI·SDP 응답이나 보안 조치가 아닙니다. Ctrl+C로 종료합니다.

기준 커밋은 ac8bda0387c767f4d62d0ebb1bfae14fc6e8d993이며 renderExplanation만 변경합니다. 실제 앱의 원천 기록 미연결과 공식 코드 판정은 별도 상태로 기록합니다.
