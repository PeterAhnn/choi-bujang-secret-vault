import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationSection } from '../src/verification-results.mjs';

const snapshot = records => ({ schema: 'aleph.http.results.v1', testedCommit: 'a'.repeat(40), records });
const measured = (overrides = {}) => ({ caseId: 's11_normal', source: 'measured_http', status: 200,
  requestId: 'server-request-id', checkedAt: '2026-10-13T08:00:00.000Z', observed: 'HTTP 200', ...overrides });

test('unexecuted cases and the complete 41-case campaign remain unexecuted', () => {
  const section = verificationSection({ schema: 'aleph.http.results.v1', testedCommit: null, records: [] });
  assert.equal(section.rows.length, 18);
  assert.ok(section.rows.every(row => row[3] === '미실행'));
});

test('the fixed expectation detects wrong status and missing evidence without inventing request IDs', () => {
  assert.equal(verificationSection(snapshot([measured()])).rows[15][3], '실측 일치');
  assert.equal(verificationSection(snapshot([measured({ status: 403 })])).rows[15][3], '기대와 다름');
  assert.equal(verificationSection(snapshot([measured({ requestId: '' })])).rows[15][3], '근거 부족');
  assert.equal(verificationSection(snapshot([measured({ checkedAt: '' })])).rows[15][3], '근거 부족');
});

test('unknown cases, duplicate evidence and additional sensitive fields cannot enter the table', () => {
  for (const records of [[measured({ caseId: 'made_up' })], [measured(), measured()],
    [measured({ token: 'do-not-retain' })], [measured({ source: 'local_fixture' })]]) {
    assert.throws(() => verificationSection(snapshot(records)), /INVALID_VERIFICATION_EVIDENCE/u);
  }
});
