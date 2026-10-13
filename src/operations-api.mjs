import { randomUUID } from 'node:crypto';
import { RULE_IDS } from './decider.mjs';
import safeManifest from '../policy/safe-policy-manifest.json' with { type: 'json' };
import { DEVICE_ID, DeviceError, deviceConfiguration, deviceFetch,
  deviceIdentityVerifier, deviceResponseHeaders, readDevice } from './device-api.mjs';

const columns = ['항목', '결과', '검증 범위'];
const section = (title, rows) => ({ title, columns: [...columns], rows });
const safeLogger = summary => console.info(JSON.stringify({ event: 'operations_summary', ...summary }));

async function exactCount(connection, fetchImpl, table, field, userId, select) {
  const upstream = await deviceFetch(connection, fetchImpl, '/rest/v1/' + table, {
    method: 'HEAD', prefer: 'count=exact', params: { [field]: 'eq.' + userId, select },
  });
  const range = upstream.headers?.get('content-range');
  const match = typeof range === 'string' && /^(\*|([0-9]+)-([0-9]+))\/([0-9]+)$/u.exec(range);
  if (!match) throw new DeviceError(502, 'OPERATIONS_UNAVAILABLE');
  const total = Number(match[4]);
  if (!Number.isSafeInteger(total) || (match[1] !== '*'
      && (!Number.isSafeInteger(Number(match[2])) || !Number.isSafeInteger(Number(match[3]))
        || Number(match[2]) > Number(match[3]) || Number(match[3]) >= total))) {
    throw new DeviceError(502, 'OPERATIONS_UNAVAILABLE');
  }
  return total;
}

function configurationSummary() {
  if (!Array.isArray(RULE_IDS) || RULE_IDS.some(rule => typeof rule !== 'string')
      || !/^[a-f0-9]{40}$/u.test(safeManifest.safeCommit ?? '')
      || !Array.isArray(safeManifest.files)) throw new DeviceError(503, 'OPERATIONS_NOT_CONFIGURED');
  return {
    rules: RULE_IDS.join(', '), ruleCount: String(RULE_IDS.length),
    safeCommit: safeManifest.safeCommit, fileCount: String(safeManifest.files.length),
  };
}

export function createOperationsHandler({ env = process.env, fetchImpl = fetch,
  verifyAuthorization, logger = safeLogger, now = Date.now } = {}) {
  if (typeof logger !== 'function' || typeof now !== 'function') throw new TypeError('invalid_operations_options');
  const verifyIdentity = deviceIdentityVerifier({ env, verifyAuthorization });
  return async function handler(request, response) {
    deviceResponseHeaders(response);
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    try {
      const identity = await verifyIdentity(request);
      let url;
      try { url = new URL(request.url, 'https://library.invalid'); }
      catch { throw new DeviceError(403, 'RESOURCE_NOT_ALLOWED'); }
      if (url.pathname !== '/api/operations' || url.search || url.hash) {
        throw new DeviceError(403, 'RESOURCE_NOT_ALLOWED');
      }
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new DeviceError(405, 'METHOD_NOT_ALLOWED');
      }
      const deviceId = request.headers?.['x-device-id'];
      if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) {
        throw new DeviceError(403, 'DEVICE_NOT_APPROVED');
      }
      const configured = configurationSummary();
      const connection = deviceConfiguration(env);
      const currentDevice = await readDevice(connection, fetchImpl, deviceId);
      if (!currentDevice || currentDevice.status !== 'approved') {
        throw new DeviceError(403, 'DEVICE_NOT_APPROVED');
      }
      const [backups, recoveries, requestedDevices] = await Promise.all([
        exactCount(connection, fetchImpl, 'defense_note_backups', 'owner_id', identity.userId, 'note_id'),
        exactCount(connection, fetchImpl, 'defense_note_recovery_audit', 'owner_id', identity.userId, 'id'),
        exactCount(connection, fetchImpl, 'defense_devices', 'requested_by', identity.userId, 'device_id'),
      ]);
      const summary = {
        schema: 'aleph.operations.v1', requestId, checkedAt: new Date(now()).toISOString(),
        engine: 'ALEPH SDP 엔진 사용',
        sections: [
          section('판정기 규칙', [
            ['구성 규칙 수', configured.ruleCount, '배포된 RULE_IDS에서 읽은 수이며 운영 판정 횟수가 아닙니다.'],
            ['구성 규칙', configured.rules, '학생이 구현한 판정기 규칙입니다. 제공 엔진과 구분합니다.'],
          ]),
          section('탐지 사건', [
            ['운영 탐지 사건', '미실행', '운영 사건 입력이 미연결이므로 탐지 건수를 집계하지 않습니다.'],
          ]),
          section('회수 상태와 기기', [
            ['운영 신원 회수', '미실행', '탐지 제안과 운영 회수 집행의 연결을 확인하지 않았습니다.'],
            ['현재 요청 기기 상태', currentDevice.status, '실측: 현재 요청 기기의 DB 상태를 다시 읽었습니다.'],
            ['내가 요청한 기기 수', String(requestedDevices), '실측: 현재 로그인 사용자가 요청한 기기만 정확히 집계했습니다.'],
          ]),
          section('복구 버전과 기록', [
            ['안전 정책 명세 버전', configured.safeCommit, '배포에 포함된 안전 명세의 기준 커밋입니다.'],
            ['안전 명세 파일 수', configured.fileCount, '명세에 기재된 파일 수이며 운영 사본의 검증 결과가 아닙니다.'],
            ['운영 정책 사본 재검증', '미실행', '이 API는 로컬 사본을 읽거나 해시를 다시 검증하지 않습니다.'],
            ['내 비공개 메모 백업 수', String(backups), '실측: 검증한 소유자의 사본 수만 정확히 집계했습니다. 본문은 읽지 않았습니다.'],
            ['내 메모 복구 감사 수', String(recoveries), '실측: 검증한 소유자의 복구 감사 수만 정확히 집계했습니다.'],
          ]),
        ],
      };
      // The identical, content-free summary is the server-side comparison record.
      logger(summary);
      return response.status(200).json(summary);
    } catch (error) {
      if (error instanceof DeviceError && error.status < 500) {
        return response.status(error.status).json({ error: error.code });
      }
      if (error instanceof DeviceError && error.status === 503) {
        return response.status(503).json({ error: 'OPERATIONS_NOT_CONFIGURED' });
      }
      return response.status(502).json({ error: 'OPERATIONS_UNAVAILABLE' });
    }
  };
}
