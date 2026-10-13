// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 등록 여부는 엔진이 확인한 불리언 값만 인정합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'resource_scope']);

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

// Resource grants come from trusted server configuration, never request JSON.
// Snapshot the policy so a caller cannot mutate grants after initialization.
export function createDecider(resourcePolicies = null) {
  const policies = resourcePolicies === null ? null : Array.isArray(resourcePolicies) ? resourcePolicies.map(policy => ({
    classId: policy?.classId, projectId: policy?.projectId,
    policyRevision: policy?.policyRevision, service: policy?.service,
    path: policy?.path, routePath: policy?.routePath,
    grants: Array.isArray(policy?.grants) ? policy.grants.map(grant => ({
      subjectId: grant?.subjectId, deviceId: grant?.deviceId,
      methods: Array.isArray(grant?.methods) ? [...grant.methods] : [],
    })) : [],
  })) : [];
  return async function decide(request) {
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
  const basePath = request.service === 'notes'
    && (request.path === '/notes' || request.path === '/api/notes');
  const item = /^\/(?:api\/)?(notes|announcements)\/([A-Za-z0-9_-]+)$/u.exec(request.path ?? '');
  const itemPath = item && request.service === item[1]
    && !['export', 'admin', 'search', 'all'].includes(item[2].toLowerCase());
  const routePath = basePath ? request.path
    : itemPath ? request.path.replace(/\/[^/]+$/u, '/:id') : null;
  // Existing authenticated note routes keep their final API ownership check.
  // An explicitly supplied policy is enforced; an empty policy never grants an item.
  const exactGrant = itemPath && (policies === null && request.service === 'notes' || policies?.some(policy =>
    policy.classId === request.classId && policy.projectId === request.projectId
    && Number.isInteger(policy.policyRevision) && policy.policyRevision === request.policyRevision
    && policy.service === request.service && policy.path === request.path
    && policy.routePath === routePath && policy.grants.some(grant =>
      typeof grant.subjectId === 'string' && grant.subjectId === request.subjectId
      && typeof grant.deviceId === 'string' && grant.deviceId === request.deviceId
      && grant.methods.includes(request.method))));
  const resourceAllowed = typeof request.classId === 'string' && request.classId.length > 0
    && typeof request.projectId === 'string' && request.projectId.length > 0
    && typeof request.subjectId === 'string' && request.subjectId.length > 0
    && typeof request.deviceId === 'string' && /^[a-f0-9]{16}$/u.test(request.deviceId)
    && request.queryLength === 0 && routePath !== null
    && request.route === `${request.method} ${routePath}`
    && (basePath && ['GET', 'POST'].includes(request.method)
      || exactGrant && ['GET', 'PUT', 'DELETE'].includes(request.method));
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: !registered || !resourceAllowed ? 'deny' : needsStepUp ? 'step_up' : 'allow',
    reasonCode: !registered ? 'device_not_registered' : !resourceAllowed ? 'starter_not_ready'
      : needsStepUp ? 'step_up_required' : 'approved',
    ruleIds: !registered ? [RULE_IDS[0]] : [...RULE_IDS],
  };
  };
}

// Preserve the existing engine entry point and require final API ownership checks.
// Trusted per-resource policies can be supplied only by server configuration.
const defaultDecider = createDecider();
export async function decide(request) {
  return defaultDecider(request);
}
