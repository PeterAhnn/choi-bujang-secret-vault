import { readFile } from 'node:fs/promises';
import { extractAlert } from './read-alerts.mjs';

const patterns = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8')).patterns;
const repeat = patterns.find(p => p.name === 'repeated-login-failure');
const spray = patterns.find(p => p.name === 'password-spraying');
const actionFor = confidence => confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record';

// Provider injection keeps credentials and an unverified endpoint out of source.
// A missing, invalid, or timed-out Jev response is the official alert fallback.
export function createDecider({ askJev = async () => null, timeoutMs = 1000 } = {}) {
  return async function decide(alert) {
    const row = extractAlert(alert);
    const description = row.description;
    const count = Number(alert?.data?.count) || Number(description.match(/(\d+)건/)?.[1]) || 0;
    const spraying = /여러 계정|서로 다른 계정|계정\s*\d+개|같은 비밀번호/.test(description);
    const failure = /실패/.test(description) || (spraying && /연속으로 넣|대입/.test(description));
    const repeated = /짧은 시간|분 안|분 동안|같은 주소|같은 계정|연속|이어|비밀번호.*바꿔|성공은 없/.test(description);
    const pattern = spraying ? spray : repeat;
    if (failure && row.source && row.account && row.level >= pattern.minimumLevel
        && (count >= repeat.minimumCount || spraying || repeated)) {
      return { action: 'block', confidence: 0.95, reason: pattern.name };
    }
    if (!failure || row.level <= 3) {
      return { action: 'record', confidence: 0.1, reason: 'normal-event' };
    }
    let timer;
    try {
      const response = await Promise.race([
        askJev({ pattern: pattern.name, alert: row }),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); }),
      ]);
      const confidence = response?.confidence;
      if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return { action: 'alert', confidence: 0.5, reason: `${pattern.name}: Jev unavailable` };
      }
      return { action: actionFor(confidence), confidence, reason: pattern.name };
    } catch {
      return { action: 'alert', confidence: 0.5, reason: `${pattern.name}: Jev unavailable` };
    } finally {
      clearTimeout(timer);
    }
  };
}
export const decide = createDecider();
