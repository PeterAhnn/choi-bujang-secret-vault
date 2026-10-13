const offlineCache = 'defense-public-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(offlineCache).then(cache => cache.addAll(['/offline.html', '/app-icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only the public root navigation has a static fallback. Auth and APIs are never cached.
  if (event.request.mode === 'navigate' && url.origin === self.location.origin && url.pathname === '/') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
  }
});
