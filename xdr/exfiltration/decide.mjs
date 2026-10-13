const PATTERNS = Object.freeze([
  { name: 'unusual-bulk-transfer', condition: '대용량 또는 다수 파일과 낯선 목적지·비정상 포트·업무 외·반복 전송의 결합', evidence: 'MITRE ATT&CK T1048: 비정상 프로토콜과 전송량·시간대' },
  { name: 'c2-data-transfer', condition: '명령 통로에서 큰 파일이나 반복 자료 전송', evidence: 'MITRE ATT&CK T1041: 기존 명령 통로를 통한 유출' },
  { name: 'transfer-review', condition: '중간 위험 수준이며 전송을 확정할 맥락이 부족함', evidence: 'MITRE ATT&CK T1041/T1048: 비정상 전송 행위 조사' },
]);

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description.slice(0, 3000) : '';
  const level = Number(alert?.rule?.level);
  const bytes = Number(alert?.data?.bytes);
  const files = Number(alert?.data?.files);
  const count = Number(alert?.data?.count);
  const destination = typeof alert?.data?.dstip === 'string' && alert.data.dstip.length > 0;
  const substantial = bytes >= 50_000_000 || files >= 50 || /대용량|큰 파일|자료실 전체/u.test(description);
  const unusual = /처음|시간 밖|쓰지 않던 포트|반복|연속|전체.*외부/u.test(description) || count >= 5;
  const sent = /전송|나갔|올라갔|복사/u.test(description) && !/전송은.*없|전송이 실패|큰 파일은 아닙/u.test(description);
  if (level >= 10 && destination && substantial && unusual && sent) {
    return { action: 'block', confidence: 0.95, reason: PATTERNS[/명령 통로/u.test(description) ? 1 : 0].name };
  }
  if (level >= 4) return { action: 'alert', confidence: 0.6, reason: PATTERNS[2].name };
  return { action: 'record', confidence: 0.1, reason: 'normal-event' };
}
