import { client } from './auth.js';
import { isDeviceApproved, protectedFetch } from './device.js';

const list = document.querySelector('#notes');
const editor = document.querySelector('#note-editor');
const form = document.querySelector('#note-form');
const titleInput = document.querySelector('#note-title');
const bodyInput = document.querySelector('#note-body');
const saveButton = document.querySelector('#note-save');
const cancelButton = document.querySelector('#note-cancel');
const operationStatus = document.querySelector('#operation-status');
const restoreDeleted = document.querySelector('#restore-deleted');
let deletedId;
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
  const response = await protectedFetch(path, method, body);
  if (response.status === 401 || response.status === 403) throw new Error('로그인 확인에 실패했습니다. 다시 로그인해 주세요.');
  if (response.status === 404) {
    const error = new Error('메모가 없습니다. 목록을 새로 확인해 주세요.');
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error('메모 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return response.json();
}
async function loadNotes() {
  const version = ++requestVersion;
  if (!session?.access_token) {
    showMessage('로그인하면 가상 자료를 볼 수 있습니다.');
    return;
  }
  if (!isDeviceApproved()) {
    showMessage('서버의 기기 승인이 필요합니다. 승인 전에는 보호 자료를 표시하지 않습니다.');
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
        const actor = session?.user?.id;
        remove.disabled = true;
        try {
          await api(`/api/notes/${encodeURIComponent(note.id)}`, 'DELETE');
          try {
            await api(`/api/notes/${encodeURIComponent(note.id)}`);
            throw new Error('삭제 결과를 확인하지 못했습니다. 목록을 다시 확인해 주세요.');
          } catch (error) { if (error.status !== 404) throw error; }
          if (session?.user?.id !== actor) return;
          if (editingId === note.id) resetEditor();
          deletedId = note.id;
          restoreDeleted.hidden = false;
          operationStatus.textContent = '가상 메모를 삭제했습니다.';
          await loadNotes();
        } catch (error) { operationStatus.textContent = error.message; remove.disabled = false; }
      });
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = '백업으로 복구';
      restore.addEventListener('click', () => restoreNote(note.id, restore));
      actions.append(edit, document.createTextNode(' '), remove, document.createTextNode(' '), restore);
      item.append(title, body, actions);
      return item;
    }));
  } catch (error) { if (version === requestVersion) showMessage(error.message); }
}
async function restoreNote(id, button) {
  const actor = session?.user?.id;
  button.disabled = true;
  try {
    const restored = await api('/api/restore', 'POST', { id });
    if (restored.id !== id || restored.restored !== true || !/^[a-f0-9]{64}$/u.test(restored.contentHash ?? '')) {
      throw new Error('복구 결과를 확인하지 못했습니다.');
    }
    if (session?.user?.id !== actor) return;
    if (deletedId === id) { deletedId = undefined; restoreDeleted.hidden = true; }
    operationStatus.textContent = '백업에서 메모 한 건을 복구했습니다.';
    await loadNotes();
  } catch (error) { operationStatus.textContent = error.message; }
  finally { button.disabled = false; }
}
restoreDeleted.addEventListener('click', () => { if (deletedId) void restoreNote(deletedId, restoreDeleted); });
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
  if (session?.user?.id !== nextSession?.user?.id) {
    deletedId = undefined;
    restoreDeleted.hidden = true;
  }
  session = nextSession;
  editor.hidden = !session?.user || !isDeviceApproved();
  resetEditor();
  operationStatus.textContent = '';
  void loadNotes();
}
client.auth.onAuthStateChange((_event, nextSession) => { changeSession(nextSession); });
document.addEventListener('device-approval-changed', () => {
  editor.hidden = !session?.user || !isDeviceApproved();
  if (!isDeviceApproved()) { deletedId = undefined; restoreDeleted.hidden = true; }
  void loadNotes();
});
const { data } = await client.auth.getSession();
changeSession(data.session);
