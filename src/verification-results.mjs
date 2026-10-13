import evidence from '../evidence/step-12-http-results.json' with { type: 'json' };

export const VERIFICATION_CASES = Object.freeze([
  { id: 's01_anonymous_read', name: '1단계: 무인증 자료 조회', expected: 401 },
  { id: 's02_static_json', name: '2단계: 빈 공개 JSON', expected: 200, notes: 0 },
  { id: 's03_invalid_login', name: '3단계: 잘못된 로그인 토큰', expected: 401 },
  { id: 's04_own_read', name: '4단계: B의 자기 메모 한 건 조회', expected: 200 },
  { id: 's04_other_owner', name: '4단계: B의 A 메모 조회', expected: 404 },
  { id: 's05_direct_storage', name: '5단계: 공개 키의 원본 DB 직접 조회', expected: 401 },
  { id: 's06_unregistered', name: '6단계: 미등록 기기', expected: 403 },
  { id: 's07_step_up', name: '7단계: 복합 이상 접속', expected: null, expectedLabel: '추가 본인 확인' },
  { id: 's08_other_zone', name: '8단계: 공지 쓰기·전체 목록 구역', expected: 403 },
  { id: 's09_revoked_identity', name: '9단계: 운영 엔진의 신원 회수', expected: null, expectedLabel: '회수 후 거부' },
  { id: 's10_anonymous_restore', name: '10단계: 무인증 복구', expected: 401 },
  { id: 's10_own_restore', name: '10단계: B의 자기 메모 복구', expected: 200 },
  { id: 's11_unsigned', name: '11단계: 로그인했지만 서명 없음', expected: 403 },
  { id: 's11_path_tamper', name: '11단계: 서명 뒤 경로 변경', expected: 403 },
  { id: 's11_body_tamper', name: '11단계: 서명 뒤 본문 변경', expected: 403 },
  { id: 's11_normal', name: '11단계: 승인 기기의 정상 서명', expected: 200 },
  { id: 's11_replay', name: '11단계: 동일 서명 재전송', expected: 403 },
]);

export function verificationSection(snapshot = evidence) {
  if (snapshot?.schema !== 'aleph.http.results.v1' || !Array.isArray(snapshot.records)
      || snapshot.records.length > VERIFICATION_CASES.length
      || (snapshot.testedCommit !== null && !/^[a-f0-9]{40}$/u.test(snapshot.testedCommit))) {
    throw new Error('INVALID_VERIFICATION_EVIDENCE');
  }
  const records = new Map();
  const known = new Set(VERIFICATION_CASES.map(test => test.id));
  const allowed = new Set(['caseId', 'source', 'status', 'requestId', 'checkedAt', 'observed', 'publicNotesCount']);
  for (const record of snapshot.records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)
        || Object.keys(record).some(key => !allowed.has(key)) || !known.has(record.caseId)
        || records.has(record.caseId) || record.source !== 'measured_http'
        || !Number.isInteger(record.status) || record.status < 100 || record.status > 599
        || typeof record.observed !== 'string' || record.observed.length > 200
        || typeof record.requestId !== 'string' || record.requestId.length > 200
        || typeof record.checkedAt !== 'string' || record.checkedAt.length > 40
        || (record.publicNotesCount !== undefined && (!Number.isInteger(record.publicNotesCount)
          || record.publicNotesCount < 0))) throw new Error('INVALID_VERIFICATION_EVIDENCE');
    records.set(record.caseId, record);
  }
  const rows = VERIFICATION_CASES.map(test => {
    const record = records.get(test.id);
    const expected = test.expectedLabel ?? `HTTP ${test.expected}${test.notes === 0 ? '·메모0건' : ''}`;
    if (!record) return [test.name, expected, '미실행', '미실행', '미제공', '미제공'];
    const complete = snapshot.testedCommit !== null && record.requestId.length > 0
      && Number.isFinite(Date.parse(record.checkedAt));
    const passed = complete && record.status === test.expected
      && (test.notes === undefined || record.publicNotesCount === test.notes);
    return [test.name, expected, record.observed,
      !complete ? '근거 부족' : passed ? '실측 일치' : '기대와 다름',
      record.requestId || '미제공', record.checkedAt || '미제공'];
  });
  rows.push(['41종 총공세 전체', '공식 심판의 41종 방어',
    '학생 자체 41종 일괄 실측은 미실행', '미실행', '공식 심판 기록은 별도', '미제공']);
  return { title: '1~11단계 요청 확인 표',
    columns: ['시험', '기대 결과', '실제 API 결과', '확인 상태', '요청 ID', '확인 시각'], rows };
}

export function verificationSourceSection(snapshot = evidence) {
  verificationSection(snapshot);
  return { title: '실측 근거의 범위', columns: ['항목', '결과', '검증 범위'], rows: [
    ['검사한 커밋', snapshot.testedCommit ?? '미실행', '실제 HTTP 요청을 실행한 소스 버전입니다. 현재 배포의 성공 문구로 대신하지 않습니다.'],
    ['기록 출처', '실제 HTTP 응답과 가린 서버 응답 기록', '고정 시험 절차의 요청 ID·시각·메서드·자원을 대조했습니다. 메모·토큰·서명은 제외합니다.'],
    ['미실행 항목', '위 표에 별도로 표시', '앞 단계 공식 통과 이력을 현재 제출본의 새 실측 결과로 소급하지 않습니다.'],
  ] };
}
