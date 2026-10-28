# 22단계 재현 근거

기준 원천 커밋은 `a3c66e394502c517b722d67ff68b1b4094a4528e`이다. 이번 단계에서 앱 코드를 변경하지 않는다.

| 파일 | 범위 |
|---|---|
| original-preservation.json | 기존 폴더의 실행 코드·의존성, 단계 근거와 사용자 사본 보존 확인이다. 사본의 내용은 공개하지 않는다. |
| source-identity.json | 기준 GitHub clone과 원래 저장소의 실행 Git blob 및 줄바꿈 정규화 내용 대조다. |
| runtime-reproduction.json | 새 폴더의 환경·절차·관찰 결과와 사용자 보존 확인을 구분한 기록이다. |
| browser-reproduction.json | 해당 새 복제본의 실제 로컬 예제 UI 확인이다. 외부 시스템 연결 성공이 아니다. |
| contract-results.json | 새 복제본의 20단계 합성 표시 계약·앞 단계 원문 보존 68개와 합성 지연 응답 검사다. 실제 외부 통신은 0회다. 13~21 전 기능 재시험이 아니다. |

최종 제출 전 같은 런타임 원문을 가진 제출 커밋을 새 폴더에 고정해 실행을 추가 확인한다. 그 정확한 커밋과 결과는 최종 확인 기록으로 구분한다. 과거 각 단계의 공식 검토를 최종 커밋 전체 실운영 성공으로 합치지 않는다.

contract-results.json의 baselineCommit a5b77e0은 하네스의 원문 비교 기준이고 실제 복제·실행 원천은 a3c66e3이다. 사용자 직접 확인 두 건은 runtime-reproduction.json에 별도로 기록한다.
