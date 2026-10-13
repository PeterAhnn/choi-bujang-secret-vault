import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { POLICY_PATHS, SAFE_POLICY_COMMIT, preparePolicyRecovery, previewPolicyRecovery,
  validatePolicyManifest, applyPolicyRecovery } from '../src/policy-recovery.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const digest = data => createHash('sha256').update(data).digest('hex');
const sourceHashes = async () => Promise.all(POLICY_PATHS.map(async path => [path, digest(await readFile(join(repositoryRoot, path)))]));

// Start deliberate tamper exercises at the verified safe version, independent of the current stage config.
async function safeTrial(options) {
  const report = await preparePolicyRecovery(options);
  const backup = JSON.parse(await readFile(join(options.workspaceRoot, '.local', 'policy-backup.json'), 'utf8'));
  for (const file of backup.files) {
    await writeFile(join(report.trialDirectory, file.path), Buffer.from(file.contentBase64, 'base64'));
  }
  assert.deepEqual((await previewPolicyRecovery(options)).changedFiles, []);
  return report;
}

async function workspace(t) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'aleph-policy-preview-'));
  await mkdir(join(workspaceRoot, 'policy'));
  await copyFile(join(repositoryRoot, 'policy', 'safe-policy-manifest.json'), join(workspaceRoot, 'policy', 'safe-policy-manifest.json'));
  t.after(async () => {
    assert.ok(resolve(workspaceRoot).startsWith(`${resolve(tmpdir())}${sep}aleph-policy-preview-`));
    await rm(workspaceRoot, { recursive: true, force: true });
  });
  return { repositoryRoot, workspaceRoot };
}

test('real safe commit backup verifies and preview only exposes paths and hashes', async t => {
  const options = await workspace(t);
  const before = await sourceHashes();
  const report = await safeTrial(options);
  assert.equal(report.safeCommit, SAFE_POLICY_COMMIT);
  assert.equal(report.verifiedFiles, POLICY_PATHS.length);
  assert.equal(report.productionChanged, false);
  assert.ok(report.trialDirectory.startsWith(`${options.workspaceRoot}${sep}.local${sep}`));
  const path = join(report.trialDirectory, 'src', 'decider.mjs');
  await writeFile(path, `${await readFile(path, 'utf8')}\n// synthetic trial change\n`);
  const preview = await previewPolicyRecovery(options);
  assert.equal(preview.changedFiles.length, 1);
  assert.deepEqual(Object.keys(preview.changedFiles[0]).sort(), ['path', 'safeSha256', 'trialSha256']);
  assert.equal(preview.changedFiles[0].path, 'src/decider.mjs');
  assert.notEqual(preview.changedFiles[0].trialSha256, preview.changedFiles[0].safeSha256);
  assert.ok(!JSON.stringify(preview).includes('synthetic trial change'));
  assert.deepEqual(await sourceHashes(), before);
  await assert.rejects(preparePolicyRecovery(options), { code: 'RECOVERY_COPY_ALREADY_EXISTS' });
});

test('missing and corrupted backups stop before a preview is returned', async t => {
  const options = await workspace(t);
  await assert.rejects(previewPolicyRecovery(options), { code: 'RECOVERY_FILE_MISSING' });
  await preparePolicyRecovery(options);
  const path = join(options.workspaceRoot, '.local', 'policy-backup.json');
  const backup = JSON.parse(await readFile(path, 'utf8'));
  backup.files[0].contentBase64 = Buffer.from('synthetic corruption').toString('base64');
  await writeFile(path, JSON.stringify(backup));
  await assert.rejects(previewPolicyRecovery(options), { code: 'BACKUP_HASH_MISMATCH' });
});

test('manifest commit, hashes, duplicates and outside paths cannot replace the safe baseline', async t => {
  const options = await workspace(t);
  const path = join(options.workspaceRoot, 'policy', 'safe-policy-manifest.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  assert.throws(() => validatePolicyManifest({ ...original, safeCommit: 'a'.repeat(40) }), { code: 'INVALID_SAFE_MANIFEST' });
  assert.throws(() => validatePolicyManifest({ ...original, files: original.files.map((file, index) =>
    index ? file : { ...file, path: '../outside.txt' }) }), { code: 'INVALID_MANIFEST_PATHS' });
  assert.throws(() => validatePolicyManifest({ ...original, files: original.files.map((file, index) =>
    index ? file : original.files[1]) }), { code: 'INVALID_MANIFEST_PATHS' });
  const forged = structuredClone(original);
  forged.files[0].sha256 = '0'.repeat(64);
  await writeFile(path, JSON.stringify(forged));
  await assert.rejects(preparePolicyRecovery(options), { code: 'MANIFEST_GIT_MISMATCH' });
  assert.equal(await lstat(join(options.workspaceRoot, '.local')).then(() => true, () => false), false);
});

test('trial paths stay inside the absolute private directory and reject links', async t => {
  const options = await workspace(t);
  await assert.rejects(previewPolicyRecovery({ repositoryRoot: '.' }), { code: 'ABSOLUTE_WORKSPACE_REQUIRED' });
  await preparePolicyRecovery(options);
  const trial = join(options.workspaceRoot, '.local', 'policy-trial');
  await writeFile(join(trial, 'unexpected.txt'), 'synthetic extra file');
  await assert.rejects(previewPolicyRecovery(options), { code: 'TRIAL_PATH_REJECTED' });
  await rm(join(trial, 'unexpected.txt'));
  const trialSources = resolve(trial, 'src');
  assert.ok(trialSources.startsWith(`${resolve(options.workspaceRoot)}${sep}.local${sep}policy-trial${sep}`));
  await rm(trialSources, { recursive: true });
  const outside = join(options.workspaceRoot, 'outside');
  await mkdir(outside);
  await symlink(outside, join(trial, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(previewPolicyRecovery(options), { code: 'LINK_PATH_REJECTED' });
});

test('only reviewed trial policies restore and the real API again refuses a foreign owner', async t => {
  const localRoot = resolve(repositoryRoot, '.local');
  const workspaceRoot = await mkdtemp(join(localRoot, 'policy-apply-test-'));
  assert.ok(workspaceRoot.startsWith(`${localRoot}${sep}policy-apply-test-`));
  t.after(async () => {
    assert.ok(resolve(workspaceRoot).startsWith(`${localRoot}${sep}policy-apply-test-`));
    await rm(workspaceRoot, { recursive: true, force: true });
  });
  await mkdir(join(workspaceRoot, 'policy'));
  await copyFile(join(repositoryRoot, 'policy', 'safe-policy-manifest.json'), join(workspaceRoot, 'policy', 'safe-policy-manifest.json'));
  const options = { repositoryRoot, workspaceRoot };
  await safeTrial(options);
  const auditPath = join(workspaceRoot, '.local', 'audit.jsonl');
  const servicePath = join(workspaceRoot, 'other-service-policy.json');
  await writeFile(auditPath, 'synthetic trial started\n');
  await writeFile(servicePath, '{"service":"synthetic-other","enabled":true}\n');
  const beforeProduction = await sourceHashes();
  const path = join(workspaceRoot, '.local', 'policy-trial', 'src', 'notes-api.mjs');
  const source = await readFile(path, 'utf8');
  const ownerFilter = "url.searchParams.set('owner_id', `eq.${identity.userId}`);";
  assert.ok(source.includes(ownerFilter));
  await writeFile(path, source.replaceAll(ownerFilter, '/* synthetic trial filter removed */'));
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const id = '33333333-3333-4333-8333-333333333333';
  const run = async suffix => {
    const { createNotesHandler } = await import(`${pathToFileURL(path).href}?${suffix}`);
    const handler = createNotesHandler({ itemRoute: true,
      env: { SUPABASE_URL: 'https://syntheticproject.supabase.co', SUPABASE_SECRET_KEY: ['sb','secret','fixture'].join('_') },
      verifyAuthorization: async value => ({ userId: value === 'a' ? a : b }),
      fetchImpl: async url => Response.json(!url.searchParams.has('owner_id') || url.searchParams.get('owner_id') === `eq.${a}`
        ? [{ note_id: id, title: 'Synthetic', content: 'Synthetic' }] : []),
    });
    const statuses = [];
    for (const actor of ['a', 'b']) {
      const result = {};
      await handler({ method: 'GET', headers: { authorization: actor }, url: `/api/notes/${id}` }, {
        setHeader() {}, status(value) { result.status = value; return this; }, json() {},
      });
      statuses.push(result.status);
    }
    return statuses;
  };
  assert.deepEqual(await run('before'), [200, 200]);
  const preview = await previewPolicyRecovery(options);
  assert.deepEqual(preview.changedFiles.map(file => file.path), ['src/notes-api.mjs']);
  await writeFile(path, `${await readFile(path, 'utf8')}\n// changed after review\n`);
  await assert.rejects(applyPolicyRecovery(options, preview.previewId), { code: 'TRIAL_CHANGED_AFTER_PREVIEW' });
  const reviewed = await previewPolicyRecovery(options);
  const applied = await applyPolicyRecovery(options, reviewed.previewId);
  assert.deepEqual(applied.restoredFiles.map(file => file.path), ['src/notes-api.mjs']);
  assert.deepEqual(await run('after'), [200, 404]);
  assert.deepEqual(await sourceHashes(), beforeProduction);
  assert.equal(await readFile(auditPath, 'utf8'), 'synthetic trial started\n');
  assert.equal(await readFile(servicePath, 'utf8'), '{"service":"synthetic-other","enabled":true}\n');
});
