import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const SAFE_POLICY_COMMIT = 'f78dc936a3f76c309b76ee6cf7b4bed397abacdd';
export const POLICY_PATHS = Object.freeze([
  'aleph.config.json', 'src/decider.mjs', 'src/detect.mjs',
  'src/notes-api.mjs', 'src/resources.mjs', 'src/verify-login.mjs',
]);
const MANIFEST_SCHEMA = 'aleph.policy.safe-manifest.v1';
const BACKUP_SCHEMA = 'aleph.policy.backup.v1';
const MAX_SOURCE_BYTES = 256 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const keysEqual = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function roots(options) {
  if (!isAbsolute(options?.repositoryRoot ?? '') || !isAbsolute(options?.workspaceRoot ?? options.repositoryRoot)) {
    fail('ABSOLUTE_WORKSPACE_REQUIRED');
  }
  const repositoryRoot = resolve(options.repositoryRoot);
  const workspaceRoot = resolve(options.workspaceRoot ?? repositoryRoot);
  return { repositoryRoot, workspaceRoot,
    manifestPath: join(workspaceRoot, 'policy', 'safe-policy-manifest.json'),
    backupPath: join(workspaceRoot, '.local', 'policy-backup.json'),
    trialDirectory: join(workspaceRoot, '.local', 'policy-trial') };
}

// Every path is derived internally; manifests cannot select files or directories.
async function checkedPath(root, target) {
  const suffix = relative(root, resolve(target));
  if (suffix === '..' || suffix.startsWith(`..${sep}`) || isAbsolute(suffix)) fail('PATH_OUTSIDE_WORKSPACE');
  let current = root;
  for (const part of ['', ...suffix.split(sep).filter(Boolean)]) {
    if (part) current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) fail('LINK_PATH_REJECTED');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return resolve(target);
}

async function exists(path) {
  try { await lstat(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function boundedFile(root, path, limit = MAX_SOURCE_BYTES) {
  await checkedPath(root, path);
  let info;
  try { info = await lstat(path); } catch { fail('RECOVERY_FILE_MISSING'); }
  if (info.nlink > 1) fail('LINK_PATH_REJECTED');
  if (!info.isFile() || info.size > limit) fail('INVALID_RECOVERY_FILE');
  const data = await readFile(path);
  if (data.length > limit) fail('INVALID_RECOVERY_FILE');
  return data;
}

function parseJSON(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_RECOVERY_JSON'); }
}

export function validatePolicyManifest(manifest) {
  if (!keysEqual(manifest, ['schema', 'safeCommit', 'files'])
      || manifest.schema !== MANIFEST_SCHEMA || manifest.safeCommit !== SAFE_POLICY_COMMIT
      || !Array.isArray(manifest.files) || manifest.files.length !== POLICY_PATHS.length) {
    fail('INVALID_SAFE_MANIFEST');
  }
  const paths = manifest.files.map(item => item?.path);
  if (new Set(paths).size !== POLICY_PATHS.length
      || [...paths].sort().join(',') !== [...POLICY_PATHS].sort().join(',')) fail('INVALID_MANIFEST_PATHS');
  for (const file of manifest.files) {
    if (!keysEqual(file, ['path', 'sha256', 'bytes']) || !/^[a-f0-9]{64}$/u.test(file.sha256 ?? '')
        || !Number.isInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_SOURCE_BYTES) {
      fail('INVALID_SAFE_MANIFEST');
    }
  }
  return manifest;
}

function gitSource(repositoryRoot, path) {
  if (!POLICY_PATHS.includes(path)) fail('POLICY_PATH_REJECTED');
  try {
    return execFileSync('git', ['-C', repositoryRoot, 'show', `${SAFE_POLICY_COMMIT}:${path}`], {
      timeout: 5000, maxBuffer: MAX_SOURCE_BYTES, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
  } catch { fail('SAFE_COMMIT_UNAVAILABLE'); }
}

async function verifiedManifest(context) {
  const manifest = validatePolicyManifest(parseJSON(await boundedFile(context.workspaceRoot, context.manifestPath, 32 * 1024)));
  const sources = new Map();
  for (const file of manifest.files) {
    const data = gitSource(context.repositoryRoot, file.path);
    if (data.length !== file.bytes || sha256(data) !== file.sha256) fail('MANIFEST_GIT_MISMATCH');
    sources.set(file.path, data);
  }
  return { manifest, sources };
}

async function verifiedBackup(context, manifest) {
  const backup = parseJSON(await boundedFile(context.workspaceRoot, context.backupPath, 4 * 1024 * 1024));
  if (!keysEqual(backup, ['schema', 'safeCommit', 'files']) || backup.schema !== BACKUP_SCHEMA
      || backup.safeCommit !== manifest.safeCommit || !Array.isArray(backup.files)
      || backup.files.length !== POLICY_PATHS.length) fail('INVALID_POLICY_BACKUP');
  if (new Set(backup.files.map(file => file?.path)).size !== POLICY_PATHS.length) fail('INVALID_POLICY_BACKUP');
  const sources = new Map();
  for (const file of backup.files) {
    const expected = manifest.files.find(item => item.path === file?.path);
    if (!expected || !keysEqual(file, ['path', 'sha256', 'contentBase64'])
        || typeof file.contentBase64 !== 'string' || file.contentBase64.length > MAX_SOURCE_BYTES * 2) {
      fail('INVALID_POLICY_BACKUP');
    }
    const data = Buffer.from(file.contentBase64, 'base64');
    if (data.toString('base64') !== file.contentBase64 || data.length !== expected.bytes
        || file.sha256 !== expected.sha256 || sha256(data) !== expected.sha256) fail('BACKUP_HASH_MISMATCH');
    sources.set(file.path, data);
  }
  return sources;
}

async function trialFiles(context) {
  await checkedPath(context.workspaceRoot, context.trialDirectory);
  let info;
  try { info = await lstat(context.trialDirectory); } catch { fail('TRIAL_DIRECTORY_MISSING'); }
  if (!info.isDirectory()) fail('INVALID_TRIAL_DIRECTORY');
  const found = new Set();
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      await checkedPath(context.workspaceRoot, path);
      const short = relative(context.trialDirectory, path).split(sep).join('/');
      if (entry.isDirectory()) {
        if (short !== 'src') fail('TRIAL_PATH_REJECTED');
        await walk(path);
      } else {
        if (!entry.isFile() || !POLICY_PATHS.includes(short)) fail('TRIAL_PATH_REJECTED');
        found.add(short);
      }
    }
  }
  await walk(context.trialDirectory);
  return found;
}

export async function previewPolicyRecovery(options) {
  const context = roots(options);
  const { manifest } = await verifiedManifest(context);
  await verifiedBackup(context, manifest);
  const found = await trialFiles(context);
  const changedFiles = [];
  for (const expected of manifest.files) {
    const trialSha256 = found.has(expected.path)
      ? sha256(await boundedFile(context.workspaceRoot, join(context.trialDirectory, expected.path))) : null;
    if (trialSha256 !== expected.sha256) changedFiles.push({
      path: expected.path, trialSha256, safeSha256: expected.sha256,
    });
  }
  const previewId = sha256(JSON.stringify({ safeCommit: manifest.safeCommit,
    trialDirectory: context.trialDirectory, changedFiles }));
  return { schema: 'aleph.policy.preview.v1', safeCommit: manifest.safeCommit, previewId,
    trialDirectory: context.trialDirectory, verifiedFiles: manifest.files.length,
    changedFiles, productionChanged: false };
}

async function readHandle(handle) {
  const info = await handle.stat();
  if (!info.isFile() || info.nlink > 1 || info.size > MAX_SOURCE_BYTES) fail('INVALID_RECOVERY_FILE');
  const data = Buffer.alloc(info.size);
  let offset = 0;
  while (offset < data.length) {
    const { bytesRead } = await handle.read(data, offset, data.length - offset, offset);
    if (!bytesRead) fail('TRIAL_CHANGED_AFTER_PREVIEW');
    offset += bytesRead;
  }
  if ((await handle.stat()).size !== data.length) fail('TRIAL_CHANGED_AFTER_PREVIEW');
  return data;
}

async function checkedHandle(context, path, handle) {
  await checkedPath(context.workspaceRoot, path);
  const [atPath, opened] = await Promise.all([lstat(path), handle.stat()]);
  if (!atPath.isFile() || atPath.nlink > 1 || opened.nlink > 1
      || atPath.dev !== opened.dev || atPath.ino !== opened.ino) fail('LINK_PATH_REJECTED');
}

export async function applyPolicyRecovery(options, previewId) {
  if (typeof previewId !== 'string' || !/^[a-f0-9]{64}$/u.test(previewId)) fail('INVALID_PREVIEW_ID');
  const context = roots(options);
  const preview = await previewPolicyRecovery(options);
  if (preview.previewId !== previewId) fail('TRIAL_CHANGED_AFTER_PREVIEW');
  const { manifest } = await verifiedManifest(context);
  const safeSources = await verifiedBackup(context, manifest);
  const handles = [];
  try {
    // Verify all changed files before the first restoration write.
    for (const change of preview.changedFiles) {
      if (change.trialSha256 === null) fail('TRIAL_FILE_MISSING');
      if (!POLICY_PATHS.includes(change.path)) fail('POLICY_PATH_REJECTED');
      const path = await checkedPath(context.workspaceRoot, join(context.trialDirectory, change.path));
      const handle = await open(path, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
      handles.push({ ...change, policyPath: change.path, path, handle });
      await checkedHandle(context, path, handle);
      if (sha256(await readHandle(handle)) !== change.trialSha256) fail('TRIAL_CHANGED_AFTER_PREVIEW');
    }
    // Recheck unselected policies, the manifest and backup before writing.
    if ((await previewPolicyRecovery(options)).previewId !== previewId) fail('TRIAL_CHANGED_AFTER_PREVIEW');
    for (const file of handles) {
      await checkedHandle(context, file.path, file.handle);
      if (sha256(await readHandle(file.handle)) !== file.trialSha256) fail('TRIAL_CHANGED_AFTER_PREVIEW');
      const data = safeSources.get(file.policyPath);
      if (!data || sha256(data) !== file.safeSha256) fail('BACKUP_HASH_MISMATCH');
      let offset = 0;
      while (offset < data.length) {
        const { bytesWritten } = await file.handle.write(data, offset, data.length - offset, offset);
        if (!bytesWritten) fail('TRIAL_RESTORE_FAILED');
        offset += bytesWritten;
      }
      await file.handle.truncate(data.length);
      await file.handle.sync();
      await checkedHandle(context, file.path, file.handle);
      if (sha256(await readHandle(file.handle)) !== file.safeSha256) fail('TRIAL_RESTORE_FAILED');
    }
  } finally {
    await Promise.all(handles.map(file => file.handle.close()));
  }
  const after = await previewPolicyRecovery(options);
  if (after.changedFiles.length) fail('TRIAL_RESTORE_FAILED');
  return { schema: 'aleph.policy.apply.v1', safeCommit: preview.safeCommit, previewId,
    restoredFiles: preview.changedFiles.map(file => ({ path: file.path,
      beforeSha256: file.trialSha256, safeSha256: file.safeSha256 })),
    remainingChangedFiles: after.changedFiles, productionChanged: false };
}

export async function preparePolicyRecovery(options) {
  const context = roots(options);
  const { manifest, sources } = await verifiedManifest(context);
  await checkedPath(context.workspaceRoot, context.backupPath);
  await checkedPath(context.workspaceRoot, context.trialDirectory);
  if (await exists(context.backupPath) || await exists(context.trialDirectory)) fail('RECOVERY_COPY_ALREADY_EXISTS');
  const current = new Map();
  for (const path of POLICY_PATHS) {
    const source = await boundedFile(context.repositoryRoot, join(context.repositoryRoot, path));
    // Match Git's LF text representation; never rewrite the production working file.
    current.set(path, Buffer.from(source.toString('utf8').replaceAll('\r\n', '\n'), 'utf8'));
  }
  await mkdir(join(context.workspaceRoot, '.local'), { recursive: true });
  const backup = { schema: BACKUP_SCHEMA, safeCommit: manifest.safeCommit,
    files: manifest.files.map(file => ({ path: file.path, sha256: file.sha256,
      contentBase64: sources.get(file.path).toString('base64') })) };
  await writeFile(context.backupPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await mkdir(context.trialDirectory);
  await mkdir(join(context.trialDirectory, 'src'));
  for (const [path, data] of current) {
    const destination = await checkedPath(context.workspaceRoot, join(context.trialDirectory, path));
    await writeFile(destination, data, { flag: 'wx', mode: 0o600 });
    if (sha256(await boundedFile(context.workspaceRoot, destination)) !== sha256(data)) fail('TRIAL_COPY_VERIFICATION_FAILED');
  }
  // Read the persisted backup and trial again; writing alone is not verification.
  return previewPolicyRecovery(options);
}
