import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'data.json');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
await mkdir(resolve(root, 'public'), { recursive: true });
if (config.step === 1) {
  const data = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(data.notes)) {
    throw new Error('실습용 공개 자료 형식을 확인하세요. 실제 학생 자료를 넣으면 안 됩니다.');
  }
  await copyFile(source, output);
  console.log('실습용 공개 자료를 public/data.json에 복사했습니다.');
} else if (config.step >= 2 && config.step <= 12) {
  const data = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(data.notes) || data.notes.length) {
    throw new Error('2단계부터 data.json에 메모를 남기면 안 됩니다. DB로 옮긴 뒤 비워 주세요.');
  }
  await writeFile(output, `${JSON.stringify({ sampleMarker: config.sampleMarker, notes: [] })}\n`, 'utf8');
  console.log('공개 data.json은 메모 0건입니다. 화면은 서버 API를 사용합니다.');
} else {
  throw new Error('단계 설정을 확인하세요.');
}
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
