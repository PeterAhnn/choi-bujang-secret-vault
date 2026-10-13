const PATTERNS = Object.freeze([
  { name: 'unexpected-admin-group', condition: '높은 위험 수준의 비정상 관리자 그룹 추가·재가입', evidence: 'MITRE ATT&CK T1078: 유효 계정 도용과 권한 변경' },
  { name: 'unusual-elevated-command', condition: '새 권한·낯선 주소·업무 외·타 계정 권한의 관리자 명령 또는 세션 상승', evidence: 'MITRE ATT&CK T1068: 낮은 권한에서 높은 권한으로 상승' },
  { name: 'privilege-review', condition: '중간 위험 수준의 권한 관련 경보는 검토', evidence: 'MITRE ATT&CK T1068/T1078: 계정·권한 이상 징후 조사' },
]);

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description.slice(0, 3000) : '';
  const level = Number(alert?.rule?.level);
  const group = typeof alert?.data?.group === 'string' ? alert.data.group.toLowerCase() : '';
  const adminGroup = group === 'administrators' || /관리자 그룹/u.test(description);
  const groupChange = adminGroup && /추가|들어|재가입/u.test(description)
    && !/아닙|읽기만|조회|변경은 없/u.test(description);
  const elevated = /관리자 명령|권한 명령|명령 실행|관리자 권한으로 바뀌/u.test(description);
  const unusual = /방금|곧바로|처음|시간 밖|업무처럼 보이지|다른 계정의 권한/u.test(description);
  const incomplete = /취소|실패|명령은 없/u.test(description);
  if (level >= 10 && !incomplete && (groupChange || elevated && unusual)) {
    return { action: 'block', confidence: 0.95, reason: PATTERNS[groupChange ? 0 : 1].name };
  }
  if (level >= 4) return { action: 'alert', confidence: 0.6, reason: PATTERNS[2].name };
  return { action: 'record', confidence: 0.1, reason: 'normal-event' };
}
