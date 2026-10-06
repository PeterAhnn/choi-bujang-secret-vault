import { client } from './auth.js';

const list = document.querySelector('#notes');
const editor = document.querySelector('#note-editor');
const form = document.querySelector('#note-form');
const titleInput = document.querySelector('#note-title');
const bodyInput = document.querySelector('#note-body');
const saveButton = document.querySelector('#note-save');
const cancelButton = document.querySelector('#note-cancel');
const operationStatus = document.querySelector('#operation-status');
let session;
let editingId;
let requestVersion = 0;

function showMessage(message) {
  const item = document.createElement('li');
  item.textContent = message;
  list.replaceChildren(item);
}
function resetEditor() {
  editingId = undefined;
  form.reset();
  saveButton.textContent = '메모 추가';
  cancelButton.hidden = true;
}
async function api(path, method = 'GET', body) {
  if (!session?.access_token) throw new Error('먼저 로그인해 주세요.');
  const response = await fetch(path, {
    method, credentials: 'omit', cache: 'no-store',
    headers: { Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401 || response.status === 403) throw new Error('로그인 확인에 실패했습니다. 다시 로그인해 주세요.');
  if (response.status === 404) throw new Error('메모가 없습니다. 목록을 새로 확인해 주세요.');
  if (!response.ok) throw new Error('메모 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return response.json();
}
async function loadNotes() {
  const version = ++requestVersion;
  if (!session?.access_token) {
    showMessage('로그인하면 가상 자료를 볼 수 있습니다.');
    return;
  }
  try {
    const notes = await api('/api/notes');
    if (version !== requestVersion || !session) return;
    if (!Array.isArray(notes)) throw new Error('자료 형식이 맞지 않습니다.');
    if (!notes.length) { showMessage('아직 내 가상 메모가 없습니다. 위에서 추가해 주세요.'); return; }
    list.replaceChildren(...notes.map(note => {
      const item = document.createElement('li');
      item.dataset.noteId = note.id;
      const title = document.createElement('strong');
      const body = document.createElement('span');
      title.textContent = note.title;
      body.textContent = note.body;
      const actions = document.createElement('p');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '수정';
      edit.addEventListener('click', async () => {
        try {
          const current = await api(`/api/notes/${encodeURIComponent(note.id)}`);
          editingId = current.id;
          titleInput.value = current.title;
          bodyInput.value = current.body;
          saveButton.textContent = '수정 저장';
          cancelButton.hidden = false;
          operationStatus.textContent = '선택한 가상 메모를 수정합니다.';
          titleInput.focus();
        } catch (error) { operationStatus.textContent = error.message; }
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '삭제';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await api(`/api/notes/${encodeURIComponent(note.id)}`, 'DELETE');
          if (editingId === note.id) resetEditor();
          operationStatus.textContent = '가상 메모를 삭제했습니다.';
          await loadNotes();
        } catch (error) { operationStatus.textContent = error.message; remove.disabled = false; }
      });
      actions.append(edit, document.createTextNode(' '), remove);
      item.append(title, body, actions);
      return item;
    }));
  } catch (error) { if (version === requestVersion) showMessage(error.message); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  saveButton.disabled = true;
  operationStatus.textContent = '';
  const update = !!editingId;
  try {
    await api(update ? `/api/notes/${encodeURIComponent(editingId)}` : '/api/notes',
      update ? 'PUT' : 'POST', { title: titleInput.value, body: bodyInput.value });
    resetEditor();
    operationStatus.textContent = update ? '가상 메모를 수정했습니다.' : '가상 메모를 추가했습니다.';
    await loadNotes();
  } catch (error) { operationStatus.textContent = error.message; }
  finally { saveButton.disabled = false; }
});
cancelButton.addEventListener('click', () => { resetEditor(); operationStatus.textContent = '수정을 취소했습니다.'; });
function changeSession(nextSession) {
  session = nextSession;
  editor.hidden = !session?.user;
  resetEditor();
  operationStatus.textContent = '';
  void loadNotes();
}
client.auth.onAuthStateChange((_event, nextSession) => { changeSession(nextSession); });
const { data } = await client.auth.getSession();
changeSession(data.session);
