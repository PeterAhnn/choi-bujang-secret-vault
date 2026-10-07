import { readFile } from 'node:fs/promises';
import { extractAlert } from '../brute-force/read-alerts.mjs';
export async function readAlerts() {
  const fixture=JSON.parse(await readFile(new URL('../fixtures/web-injection.json',import.meta.url),'utf8'));
  if(!Array.isArray(fixture.alerts))throw new Error('경보 배열이 없습니다.');
  return fixture.alerts.map(extractAlert);
}
