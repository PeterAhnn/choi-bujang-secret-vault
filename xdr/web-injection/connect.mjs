import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export {withXdrGuard} from '../brute-force/connect.mjs';
export function buildRules(alerts,decisions,now=Date.now()){
  const byId=new Map(alerts.map(a=>[a.id,a]));
  return decisions.filter(d=>d.action==='block'&&d.confidence>=0.85).flatMap(d=>{
    const a=byId.get(d.alertId);
    if(!a?.data?.srcip||a.rule.level<=3||Number(a.data.count)<2)return [];
    return [{moduleKey:'web-injection',source:a.data.srcip,alertId:d.alertId,expiresAt:new Date(now+15*60000).toISOString(),pattern:d.reason.split(':')[0]}];
  });
}
export async function connectResults(){
  const f=JSON.parse(await readFile(new URL('../fixtures/web-injection.json',import.meta.url),'utf8'));
  const r=JSON.parse(await readFile(new URL('./result.json',import.meta.url),'utf8'));
  const rules=buildRules(f.alerts,r.decisions);
  await writeFile(new URL('./deny-rules.json',import.meta.url),JSON.stringify({schema:'aleph.xdr.deny.v1',rules},null,2)+'\n');
  const lines=r.decisions.filter(d=>d.action!=='record').map(d=>JSON.stringify({moduleKey:'web-injection',alertId:d.alertId,action:d.action,pattern:d.reason.split(':')[0]}));
  if(lines.length)await appendFile(new URL('../alerts.log',import.meta.url),lines.join('\n')+'\n');
  return rules;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`추가 차단 규칙 ${(await connectResults()).length}개`);
