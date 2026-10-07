import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildRules(alerts, decisions, now = Date.now()) {
  const byId = new Map(alerts.map(a => [a.id,a]));
  return decisions.filter(d => d.action === 'block' && d.confidence >= 0.85).flatMap(d => {
    const a = byId.get(d.alertId);
    if (!a || a.rule?.level <= 3 || !/실패|여러 계정.*같은 비밀번호/.test(a.rule?.description || '') || !a.data?.srcip) return [];
    return [{ source:a.data.srcip, alertId:d.alertId, expiresAt:new Date(now+15*60*1000).toISOString(), pattern:d.reason.split(':')[0] }];
  });
}
// trustedSource is supplied by a verified transport, never a browser JSON field.
// No new fields are added to the engine request contract or baseline rules.
export function withXdrGuard(baseDecide, rules, clock=Date.now) {
  return async (request, trustedSource) => {
    const hit=rules.find(r=>r.source===trustedSource && Date.parse(r.expiresAt)>clock());
    if (hit) return {schema:'aleph.decision.v1',requestId:request.requestId,decision:'deny',reasonCode:'starter_not_ready',ruleIds:[`xdr.${hit.moduleKey || 'brute-force'}.${hit.alertId}`]};
    return baseDecide(request);
  };
}
export async function connectResults() {
  const fixture=JSON.parse(await readFile(new URL('../fixtures/brute-force.json',import.meta.url),'utf8'));
  const result=JSON.parse(await readFile(new URL('./result.json',import.meta.url),'utf8'));
  const rules=buildRules(fixture.alerts,result.decisions);
  await writeFile(new URL('./deny-rules.json',import.meta.url),JSON.stringify({schema:'aleph.xdr.deny.v1',rules},null,2)+'\n');
  const lines=result.decisions.filter(d=>d.action!=='record').map(d=>JSON.stringify({moduleKey:'brute-force',alertId:d.alertId,action:d.action,pattern:d.reason.split(':')[0]}));
  if(lines.length)await appendFile(new URL('../alerts.log',import.meta.url),lines.join('\n')+'\n');
  return rules;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(`추가 차단 규칙 ${(await connectResults()).length}개`);
