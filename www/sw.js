/* Cache để chạy offline.
   - index.html, app.js, manifest: ưu tiên mạng (luôn lấy bản mới nhất), mất mạng thì dùng bản đã lưu
   - font, icon, thư viện: ưu tiên bản đã lưu
   Đổi VERSION mỗi khi cập nhật code. */
const VERSION = 'v1.1.2';
const CACHE = 'so-chi-tieu-' + VERSION;
const FILES = [
  './', './index.html', './app.js', './manifest.webmanifest', './vendor/xlsx.mini.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/icon-maskable-512.png',
  './fonts/be-vietnam-pro-latin-400-normal.woff2', './fonts/be-vietnam-pro-latin-500-normal.woff2', './fonts/be-vietnam-pro-latin-700-normal.woff2',
  './fonts/be-vietnam-pro-vietnamese-400-normal.woff2', './fonts/be-vietnam-pro-vietnamese-500-normal.woff2', './fonts/be-vietnam-pro-vietnamese-700-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('so-chi-tieu-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isCore = (req, url) => req.mode === 'navigate' || /\/(app\.js|index\.html|manifest\.webmanifest)?$/.test(url.pathname);
function networkFirst(req) {
  const cached = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  const timeout = new Promise(res => setTimeout(res, 4000)).then(cached);
  return Promise.race([net.catch(cached), timeout.then(r => r || net)]);
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API đồng bộ: không cache
  if (isCore(req, url)) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
