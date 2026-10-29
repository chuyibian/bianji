// 网络优先：在线时总是向服务器确认最新版本（绕过浏览器 HTTP 缓存），
// 3 秒内没拿到或离线时退回本地缓存。每次发布只需把版本号加一。
const CACHE = 'bianji-v7';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/cat.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // 导航请求不能带 RequestInit，换成同 URL 的普通请求
  const req = e.request.mode === 'navigate' ? new Request(e.request.url) : e.request;
  const net = fetch(req, { cache: 'no-cache' }).then(async res => {
    if (res.ok) await (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith((async () => {
    const res = await Promise.race([net.catch(() => null), new Promise(r => setTimeout(r, 3000))]);
    return res || (await caches.match(e.request, { ignoreSearch: true })) || net;
  })());
});
