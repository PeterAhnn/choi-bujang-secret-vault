import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function safeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/(?:Bearer\s+)?eyJ[A-Za-z0-9_.-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/((?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/[\r\n]+/g, ' ').slice(0, 500);
}
export function extractAlert(alert) {
  return {
    timestamp: safeText(alert?.timestamp),
    source: safeText(alert?.data?.srcip),
    account: safeText(alert?.data?.srcuser),
    level: Number.isFinite(alert?.rule?.level) ? alert.rule.level : 0,
    description: safeText(alert?.rule?.description),
  };
}
export async function readAlerts(path = new URL('../fixtures/brute-force.json', import.meta.url)) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(fixture.alerts)) throw new Error('경보 배열이 없습니다.');
  return fixture.alerts.map(extractAlert);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const alert of await readAlerts()) console.log(JSON.stringify(alert));
}
