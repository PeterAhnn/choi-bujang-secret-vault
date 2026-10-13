import { client } from './auth.js';
import { isDeviceApproved, protectedFetch } from './device.js';

const panel = document.querySelector('#operations-panel');
const button = document.querySelector('#operations-refresh');
const status = document.querySelector('#operations-status');
const origin = document.querySelector('#operations-origin');
const sections = document.querySelector('#operations-sections');
let session;
let revision = 0;
const safeText = value => typeof value === 'string' && value.length <= 1000;

function renderSummary(data) {
  if (data?.schema !== 'aleph.operations.v1'
      || !/^[a-f0-9-]{36}$/u.test(data.requestId ?? '')
      || !Number.isFinite(Date.parse(data.checkedAt)) || !safeText(data.engine)
      || !Array.isArray(data.sections) || data.sections.length > 12) throw new Error('INVALID_SUMMARY');
  const rendered = data.sections.map(section => {
    if (!safeText(section.title) || !Array.isArray(section.columns)
        || !section.columns.length || section.columns.length > 8 || !section.columns.every(safeText)
        || !Array.isArray(section.rows) || section.rows.length > 100
        || !section.rows.every(row => Array.isArray(row)
          && row.length === section.columns.length && row.every(safeText))) throw new Error('INVALID_SUMMARY');
    const block = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = section.title;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = section.title;
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.append(...section.columns.map(value => {
      const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = value; return cell;
    }));
    head.append(headerRow);
    const body = document.createElement('tbody');
    body.append(...section.rows.map(row => {
      const element = document.createElement('tr');
      element.append(...row.map(value => { const cell = document.createElement('td'); cell.textContent = value; return cell; }));
      return element;
    }));
    table.append(caption, head, body); wrap.append(table); block.append(heading, wrap); return block;
  });
  sections.replaceChildren(...rendered);
  origin.textContent = `제공 엔진: ${data.engine} · 학생 작업: 판정기·탐지 규칙·접속 화면·자료실 API`;
  status.textContent = `API 확인 시각: ${data.checkedAt} · 요청 ID: ${data.requestId}`;
}

async function refresh() {
  const current = ++revision;
  const actor = session?.user?.id;
  panel.hidden = !actor || !isDeviceApproved();
  if (panel.hidden) { sections.replaceChildren(); origin.textContent = ''; status.textContent = ''; return; }
  button.disabled = true; status.textContent = '보호 API의 실제 결과를 읽고 있습니다.';
  try {
    const response = await protectedFetch('/api/operations');
    if (!response.ok) throw new Error('SUMMARY_UNAVAILABLE');
    const data = await response.json();
    if (current !== revision || session?.user?.id !== actor || !isDeviceApproved()) return;
    renderSummary(data);
  } catch {
    if (current !== revision) return;
    sections.replaceChildren(); origin.textContent = '';
    status.textContent = '작전실 API를 확인하지 못했습니다. 로그인·기기 승인·연결 상태를 확인해 주세요. 미실행으로 남깁니다.';
  } finally { if (current === revision) button.disabled = false; }
}

button.addEventListener('click', refresh);
client.auth.onAuthStateChange((_event, next) => { session = next; void refresh(); });
document.addEventListener('device-approval-changed', () => { void refresh(); });
const initial = await client.auth.getSession();
session = initial.data.session;
void refresh();
