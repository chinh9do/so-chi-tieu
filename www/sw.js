/* Cache toàn bộ app để chạy offline. Đổi VERSION mỗi khi cập nhật code. */
const VERSION = 'v1.1.0';
const CACHE = 'so-chi-tieu-' + VERSION;
const FILES = [
  './', './index.html', './app.js', './manifest.webmanifest', './vendor/xlsx.mini.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon-maskable-512.png',
  './fonts/be-vietnam-pro-latin-400-normal.woff2', './fonts/be-vietnam-pro-latin-500-normal.woff2', './fonts/be-vietnam-pro-latin-700-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-400-normal.woff2', './fonts/be-vietnam-pro-vietnamese-500-normal.woff2', './fonts/be-vietnam-pro-vietnamese-700-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('so-chi-tieu-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // API đồng bộ: không cache
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
