// 9단계의 별도 탐지 결과만 반환하며 실제 접속 회수는 집행하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.
export function readDetectionEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  return events.flatMap(event => {
    if (!event || typeof event.at !== 'string' || typeof event.method !== 'string'
        || typeof event.identity?.sub !== 'string' || !event.identity.sub.length) return [];
    const at = Date.parse(event.at);
    if (!Number.isFinite(at)) return [];
    // Keep only the documented practice fields; do not retain the original event.
    return [{ at, method: event.method, subject: event.identity.sub }];
  });
}

export function findBurstCandidate(events) {
  const reads = new Map();
  for (const event of readDetectionEvents(events)) {
    if (event.method !== 'GET') continue;
    if (!reads.has(event.subject)) reads.set(event.subject, []);
    reads.get(event.subject).push(event.at);
  }
  let candidate = null;
  for (const [subject, times] of reads) {
    times.sort((a, b) => a - b);
    let start = 0;
    for (let end = 0; end < times.length; end++) {
      while (times[end] - times[start] > 10 * 60 * 1000) start++;
      if (end - start + 1 > 120) {
        if (!candidate || times[end] < candidate.at) candidate = { subject, at: times[end] };
        break;
      }
    }
  }
  return candidate;
}

export function detect(events) {
  const candidate = findBurstCandidate(events);
  return candidate ? { action: 'propose_revocation', reasonCode: 'burst_read', subject: candidate.subject }
    : { action: 'observe' };
}
