import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

export function buildRules(alerts, decisions, now = Date.now()) {
  const byId = new Map(alerts.map(alert => [alert.id, alert]));
  return decisions.flatMap(decision => {
    const alert = byId.get(decision.alertId);
    const checked = alert && decide(alert);
    if (decision.action !== 'block' || decision.confidence < 0.85
        || checked?.action !== 'block' || !isIP(alert.data?.dstip ?? '')) return [];
    return [{ moduleKey: 'exfiltration', destination: alert.data.dstip,
      alertId: decision.alertId, expiresAt: new Date(now + 15 * 60000).toISOString(), pattern: checked.reason }];
  });
}

// trustedDestination comes from the verified transport, never browser JSON.
export function withXdrGuard(baseDecide, rules, clock = Date.now) {
  return async (request, trustedDestination) => {
    const hit = rules.find(rule => rule.destination === trustedDestination && Date.parse(rule.expiresAt) > clock());
    if (hit) return { schema: 'aleph.decision.v1', requestId: request.requestId,
      decision: 'deny', reasonCode: 'starter_not_ready', ruleIds: [`xdr.exfiltration.${hit.alertId}`] };
    return baseDecide(request);
  };
}

export async function respond() {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/exfiltration.json', import.meta.url), 'utf8'));
  const decisions = fixture.alerts.map(alert => ({ alertId: alert.id, ...decide(alert) }));
  const rules = buildRules(fixture.alerts, decisions);
  await writeFile(new URL('./deny-rules.json', import.meta.url), JSON.stringify({ schema: 'aleph.xdr.deny.v1', rules }, null, 2) + '\n');
  const lines = decisions.filter(decision => decision.action !== 'record').map(decision => JSON.stringify({
    moduleKey: 'exfiltration', alertId: decision.alertId, action: decision.action, pattern: decision.reason,
  }));
  if (lines.length) await appendFile(new URL('../alerts.log', import.meta.url), lines.join('\n') + '\n');
  return rules;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`추가 차단 규칙 ${(await respond()).length}개`);
}
