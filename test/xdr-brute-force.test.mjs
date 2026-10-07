import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDecider, decide } from '../xdr/brute-force/decide.mjs';
import { extractAlert } from '../xdr/brute-force/read-alerts.mjs';
import { buildRules, withXdrGuard } from '../xdr/brute-force/connect.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/brute-force.json', import.meta.url), 'utf8'));
test('standalone exported decide loads without sibling files and agrees on every fixture', async () => {
  const source=await readFile(new URL('../xdr/brute-force/decide.mjs',import.meta.url),'utf8');
  const isolated=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(const alert of fixture.alerts) assert.deepEqual(await isolated.decide(alert),await decide(alert));
});
test('fixtures produce all actions; low-severity normal events never block', async () => {
  const results = await Promise.all(fixture.alerts.map(decide));
  assert.deepEqual([...new Set(results.map(r => r.action))].sort(), ['alert', 'block', 'record']);
  assert.equal((await decide({timestamp:'now',rule:{level:12,description:'같은 주소가 여러 계정에 같은 비밀번호를 연속으로 넣었습니다.'},data:{srcip:'192.0.2.99',srcuser:'user01'}})).action,'block');
  assert.equal((await decide({timestamp:'now',rule:{level:12,description:'짧은 시간에 같은 계정 로그인 실패가 연속 발생'},data:{srcip:'192.0.2.98',srcuser:'user02'}})).action,'block');
  for (let i = 0; i < results.length; i++) {
    if (fixture.alerts[i].rule.level <= 3) assert.equal(results[i].action, 'record');
    assert.equal(results[i].reason.includes('\n'), false);
  }
});
test('only uncertain alerts query provider; boundaries and unavailable responses', async () => {
  const uncertain = fixture.alerts.find(a => a.rule.level === 8);
  for (const [confidence, expected] of [[0.85,'block'],[0.5,'alert'],[0.49,'record']]) {
    assert.equal((await createDecider({askJev:async () => ({confidence})})(uncertain)).action, expected);
  }
  for (const askJev of [async()=>null, async()=>({confidence:2}), async()=>{throw Error('private provider error');}, ()=>new Promise(()=>{})]) {
    const result = await createDecider({askJev,timeoutMs:5})(uncertain);
    assert.equal(result.action, 'alert');
    assert.equal(result.reason.includes('private'), false);
  }
  let calls=0;
  const check = createDecider({askJev:async()=>{calls++;return {confidence:1};}});
  await check(fixture.alerts[0]);
  await check(fixture.alerts.find(a=>a.rule.level===2));
  assert.equal(calls,0);
});
test('reader exposes only five safe fields', () => {
  const row=extractAlert({timestamp:'now', data:{srcip:'192.0.2.1',srcuser:'user01',password:'private'},rule:{level:5,description:'token=private\npassword=private'}});
  assert.equal(Object.keys(row).length,5);
  assert.equal(JSON.stringify(row).includes('private'),false);
});
test('guard denies only active candidates and preserves baseline for normal and expired sources', async () => {
  const decisions=await Promise.all(fixture.alerts.map(async a=>({alertId:a.id,...await decide(a)})));
  const now=Date.now();
  const rules=buildRules(fixture.alerts,decisions,now);
  assert.ok(rules.length>0);
  assert.ok(rules.every(r=>r.alertId && Date.parse(r.expiresAt)>now));
  const base=async request=>({schema:'aleph.decision.v1',requestId:request.requestId,decision:'allow',reasonCode:'approved',ruleIds:[]});
  const guard=withXdrGuard(base,rules,()=>now);
  const request={requestId:'synthetic-request'};
  assert.equal((await guard(request,rules[0].source)).decision,'deny');
  assert.equal((await guard(request,'192.0.2.250')).decision,'allow');
  assert.equal((await withXdrGuard(base,rules,()=>now+16*60000)(request,rules[0].source)).decision,'allow');
  for(const a of fixture.alerts.filter(a=>a.rule.level<=3)) assert.equal((await guard(request,a.data.srcip)).decision,'allow');
});
