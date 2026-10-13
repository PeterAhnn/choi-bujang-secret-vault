import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPolicyRecovery, preparePolicyRecovery, previewPolicyRecovery } from '../src/policy-recovery.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');
const messages = {
  ABSOLUTE_WORKSPACE_REQUIRED: '절대 경로인 작업 폴더가 필요합니다.',
  PATH_OUTSIDE_WORKSPACE: '작업 폴더 밖의 경로를 거부했습니다.',
  LINK_PATH_REJECTED: '링크로 연결된 경로를 거부했습니다.',
  RECOVERY_FILE_MISSING: '필수 명세 또는 안전 사본이 없습니다.',
  INVALID_RECOVERY_FILE: '사본의 파일 형식이나 크기를 확인하세요.',
  INVALID_RECOVERY_JSON: '사본 또는 명세의 JSON 형식이 잘못됐습니다.',
  INVALID_SAFE_MANIFEST: '안전 정책 명세 검증에 실패했습니다.',
  INVALID_MANIFEST_PATHS: '명세에 허용하지 않은 경로나 중복 경로가 있습니다.',
  POLICY_PATH_REJECTED: '허용하지 않은 정책 경로입니다.',
  SAFE_COMMIT_UNAVAILABLE: '검증 기준인 안전 커밋을 읽을 수 없습니다.',
  MANIFEST_GIT_MISMATCH: '명세의 해시가 실제 안전 커밋과 다릅니다.',
  INVALID_POLICY_BACKUP: '안전 사본의 구조가 잘못됐습니다.',
  BACKUP_HASH_MISMATCH: '안전 사본의 해시 검증에 실패했습니다.',
  TRIAL_DIRECTORY_MISSING: '비공개 시험 정책 폴더가 없습니다.',
  INVALID_TRIAL_DIRECTORY: '시험 정책 경로가 폴더가 아닙니다.',
  TRIAL_PATH_REJECTED: '시험 폴더에 허용하지 않은 경로나 파일이 있습니다.',
  RECOVERY_COPY_ALREADY_EXISTS: '사본이 이미 있습니다. 덮어쓰지 않고 preview로 확인하세요.',
  TRIAL_COPY_VERIFICATION_FAILED: '시험 사본을 다시 읽은 결과가 원본과 다릅니다.',
  INVALID_PREVIEW_ID: '미리보기에서 확인한 previewId가 필요합니다.',
  TRIAL_CHANGED_AFTER_PREVIEW: '미리보기 이후 시험 정책이 달라져 복구를 중단했습니다.',
  TRIAL_FILE_MISSING: '시험 정책 파일이 없어 자동 복구를 중단했습니다.',
  TRIAL_RESTORE_FAILED: '시험 정책 복구의 해시 검증에 실패했습니다.',
};

export async function main(args = process.argv.slice(2)) {
  if (!(args.length === 1 && ['prepare', 'preview'].includes(args[0]))
      && !(args.length === 2 && args[0] === 'apply')) {
    process.stderr.write('사용법: node scripts/policy-recovery.mjs prepare | preview | apply <previewId>\n');
    return 1;
  }
  try {
    const report = args[0] === 'apply' ? await applyPolicyRecovery({ repositoryRoot }, args[1])
      : await (args[0] === 'prepare' ? preparePolicyRecovery : previewPolicyRecovery)({ repositoryRoot });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ 상태: '중단', 오류: error.code ?? 'RECOVERY_REVIEW_FAILED',
      설명: messages[error.code] ?? '사본 검증에 실패해 작업을 중단했습니다.' })}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
