// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 등록 여부는 엔진이 확인한 불리언 값만 인정합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

// Engine-provided judge fixtures only; browser headers never become signals.
export function readVerifiedSignals(request) {
  const signals = request?.signals;
  if (signals?.source !== 'judge_fixture') return null;
  return {
    region: ['local', 'foreign'].includes(signals.region) ? signals.region : null,
    network: ['usual', 'unusual'].includes(signals.network) ? signals.network : null,
    hour: Number.isInteger(signals.hour) && signals.hour >= 0 && signals.hour <= 23
      ? signals.hour : null,
    recentEvents: Array.isArray(request.recentEvents)
      ? request.recentEvents.filter(event => event && typeof event.kind === 'string'
        && Number.isFinite(event.ageSeconds) && event.ageSeconds >= 0
        && Number.isInteger(event.count) && event.count >= 0) : null,
  };
}

export async function decide(request) {
  const signals = readVerifiedSignals(request);
  const unusual = signals && signals.network === 'unusual' && signals.hour !== null
    && (signals.hour < 6 || signals.hour >= 22)
    && signals.recentEvents?.some(event => event.kind === 'risk_signal'
      && event.ageSeconds <= 300 && event.count >= 10);
  const registered = request.deviceRegistered === true;
  const verifiedAgain = request.stepUp?.verified === true
    && Number.isFinite(request.stepUp.authAgeSeconds)
    && request.stepUp.authAgeSeconds >= 0 && request.stepUp.authAgeSeconds <= 900;
  const needsStepUp = unusual && !verifiedAgain;
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: !registered ? 'deny' : needsStepUp ? 'step_up' : 'allow',
    reasonCode: !registered ? 'device_not_registered' : needsStepUp ? 'step_up_required' : 'approved',
    ruleIds: unusual && registered ? [...RULE_IDS] : [RULE_IDS[0]],
  };
}
