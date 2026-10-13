const installStatus = document.querySelector('#install-status');
const installButton = document.querySelector('#install-app');
const connectionStatus = document.querySelector('#connection-status');
let installPrompt;
function showInstallation() {
  installStatus.textContent = window.matchMedia('(display-mode: standalone)').matches
    ? '접속 앱 화면으로 열었습니다. 설치 여부는 기기 승인과 별개입니다.'
    : '웹 화면입니다. 브라우저 메뉴에서 앱을 설치할 수 있습니다. 설치만으로 기기가 승인되지 않습니다.';
}
function showConnection() {
  connectionStatus.textContent = navigator.onLine ? '네트워크에 연결돼 있습니다.'
    : '오프라인입니다. 보호 자료는 캐시에 보관하지 않습니다. 연결을 복구한 뒤 다시 확인해 주세요.';
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt(); installPrompt = undefined; installButton.hidden = true;
  showInstallation();
});
window.addEventListener('appinstalled', showInstallation);
window.addEventListener('online', showConnection);
window.addEventListener('offline', showConnection);
showInstallation(); showConnection();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    connectionStatus.textContent = '오프라인 안내를 준비하지 못했습니다. 연결 상태를 확인해 주세요.';
  });
}
