import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decide} from '../xdr/web-injection/decide.mjs';
import {buildRules,withXdrGuard} from '../xdr/web-injection/connect.mjs';
const fixture=JSON.parse(await readFile(new URL('../xdr/fixtures/web-injection.json',import.meta.url),'utf8'));
test('standalone agrees with every fixture; normal events never block',async()=>{
  const source=await readFile(new URL('../xdr/web-injection/decide.mjs',import.meta.url),'utf8');
  const isolated=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const counts={block:0,alert:0,record:0};
  for(const a of fixture.alerts){const r=await decide(a);assert.deepEqual(await isolated.decide(a),r);counts[r.action]++;if(a.rule.level<=3)assert.equal(r.action,'record');if(a.rule.level>=10)assert.equal(r.action,'block');}
  assert.deepEqual(counts,{block:8,alert:9,record:9});
});
test('one-off legitimate words never automatically block; ambiguous provider boundaries',async()=>{
  const alert={timestamp:'now',rule:{level:7,description:'SQL 수업 조회'},data:{srcip:'192.0.2.55',url:'/lessons/select',count:1}};
  assert.equal((await decide(alert)).action,'alert');
  for(const [confidence,expected] of [[0.85,'block'],[0.5,'alert'],[0.49,'record']])assert.equal((await decide(alert,{askJev:async()=>({confidence})})).action,expected);
  assert.equal((await decide(alert,{askJev:()=>new Promise(()=>{}),timeoutMs:5})).action,'alert');
  assert.equal((await decide(alert,{askJev:async()=>{throw Error('private');}})).action,'alert');
});
test('only repeated block candidates are denied; normal and expired requests use baseline',async()=>{
  const now=Date.now();
  const decisions=await Promise.all(fixture.alerts.map(async a=>({alertId:a.id,...await decide(a)})));
  const rules=buildRules(fixture.alerts,decisions,now);
  const baseline=async request=>({schema:'aleph.decision.v1',requestId:request.requestId,decision:'allow',reasonCode:'approved',ruleIds:[]});
  const guard=withXdrGuard(baseline,rules,()=>now);
  const req={requestId:'synthetic-request'};
  assert.equal(rules.length,8);
  assert.equal((await guard(req,rules[0].source)).decision,'deny');
  for(const a of fixture.alerts.filter(a=>a.rule.level<=3))assert.equal((await guard(req,a.data.srcip)).decision,'allow');
  assert.equal((await withXdrGuard(baseline,rules,()=>now+16*60000)(req,rules[0].source)).decision,'allow');
});
