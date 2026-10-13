const PATTERNS = Object.freeze([
  { name: 'unsigned-service', condition: 'unsigned new/modified service with unusual executable or repeated registration', evidence: 'MITRE ATT&CK T1543' },
  { name: 'unusual-scheduled-task', condition: 'scheduled task with temporary executable or combined startup entry', evidence: 'MITRE ATT&CK T1053' },
  { name: 'unknown-startup-entry', condition: 'new executable outside the usual startup inventory', evidence: 'startup persistence; review changes alone' },
]);
export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description.slice(0, 3000) : '';
  const path = typeof alert?.data?.path === 'string' ? alert.data.path.slice(0, 2000) : '';
  const level = Number(alert?.rule?.level) || 0;
  const temporary = /[\\/]temp[\\/].*\.(?:exe|cmd|bat|ps1)$/iu.test(path);
  const service = /서비스/u.test(description) && (/서명 없는|서명이 없/u.test(description)
    && /등록|새 서비스|바뀌/u.test(description) || temporary && /평소 목록에 없는/u.test(description));
  const task = /예약 작업/u.test(description) && temporary;
  const startup = /[\\/]startup[\\/]/iu.test(path) && /평소 목록에 없는.*추가/u.test(description);
  if (level >= 10 && (service || task || startup)) {
    return { action: 'block', confidence: 0.95,
      reason: PATTERNS[service ? 0 : task ? 1 : 2].name };
  }
  if (level >= 4) return { action: 'alert', confidence: 0.6,
    reason: PATTERNS[/예약 작업/u.test(description) ? 1 : /시작/u.test(description) ? 2 : 0].name };
  return { action: 'record', confidence: 0.1, reason: 'normal-event' };
}
