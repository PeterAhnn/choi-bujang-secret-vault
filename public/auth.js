import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
// A non-key label is used for the same-origin transport; real keys stay on the server.
export const client = createClient(window.location.origin, 'auth-proxy', {
  auth: { storageKey: 'sb-hqqopjvhpgsrechaycoc-auth-token' },
});
const form = document.querySelector('#login-form');
const passwordInput = document.querySelector('#login-password');
const loginButton = document.querySelector('#login-button');
const logoutButton = document.querySelector('#logout-button');
const status = document.querySelector('#auth-status');
const errorBox = document.querySelector('#auth-error');

function showError(message) {
  errorBox.textContent = message || '';
  errorBox.hidden = !message;
}

function renderSession(session) {
  const signedIn = !!session?.user;
  form.hidden = signedIn;
  logoutButton.hidden = !signedIn;
  status.textContent = signedIn ? '로그인했습니다.' : '로그인하지 않았습니다.';
  passwordInput.value = '';
}

client.auth.onAuthStateChange((_event, session) => {
  renderSession(session);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  showError('');
  loginButton.disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: document.querySelector('#login-email').value.trim(),
      password: passwordInput.value,
    });
    passwordInput.value = '';
    if (error) {
      showError(error.code === 'invalid_credentials'
        ? '이메일 또는 비밀번호를 확인해 주세요. 이 자료실의 등록 계정으로 로그인해야 합니다.'
        : error.code === 'email_not_confirmed'
          ? '이메일 확인을 마친 뒤 로그인해 주세요.'
          : '로그인하지 못했습니다. 연결 상태와 계정 설정을 확인해 주세요.');
      return;
    }
    renderSession(data.session);
  } catch {
    passwordInput.value = '';
    showError('인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally { loginButton.disabled = false; }
});

logoutButton.addEventListener('click', async () => {
  showError('');
  logoutButton.disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) showError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    else renderSession(null);
  } catch { showError('로그아웃하지 못했습니다. 연결 상태를 확인해 주세요.'); }
  finally { logoutButton.disabled = false; }
});

const initial = await client.auth.getSession();
const { data, error } = initial.data.session
  ? await client.auth.refreshSession() : initial;
renderSession(data.session);
if (error) showError('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');
