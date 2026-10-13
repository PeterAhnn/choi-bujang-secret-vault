const PATTERNS = Object.freeze([
  { name: 'log4shell-remote-lookup', condition: 'complete remote JNDI lookup in request', evidence: 'CVE-2021-44228; MITRE ATT&CK T1190' },
  { name: 'known-cve-probe', condition: 'incomplete lookup or vulnerability probe evidence', evidence: 'MITRE ATT&CK T1190; review without proof of exploitation' },
]);

export function decide(alert) {
  const data = alert?.data ?? {};
  let input = [data.url, data.useragent, data.userAgent, data.headers, data.request]
    .map(value => typeof value === 'string' ? value.slice(0, 10000)
      : value && typeof value === 'object' ? JSON.stringify(value).slice(0, 10000) : '').join(' ');
  for (let i = 0; i < 2; i++) { try { input = decodeURIComponent(input); } catch { break; } }
  const clear = /\$\{\s*jndi\s*:\s*(?:ldaps?|rmi|dns)\s*:\/\/[^\s{}]+\}/iu.test(input);
  const level = Number(alert?.rule?.level) || 0;
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description.slice(0, 2000) : '';
  if (clear) return { action: 'block', confidence: 0.97, reason: PATTERNS[0].name };
  const probe = /jndi|CVE-2021-44228|log4j|log4shell|취약점|조회.*(?:구문|형태)|점검.*도구|라이브러리|중괄호/iu.test(input + ' ' + description);
  if (probe || level >= 4) return { action: 'alert', confidence: 0.6, reason: PATTERNS[1].name };
  return { action: 'record', confidence: 0.1, reason: 'normal-event' };
}
