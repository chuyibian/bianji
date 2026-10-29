// 先返回缓存（离线可用），同时在后台拉取最新版本更新缓存，下次打开即生效
const CACHE = 'bianji-v4';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/cat.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const net = fetch(e.request).then(async res => {
    if (res.ok) await (await caches.open(CACHE)).put(e.request, res.clone());
    return res;
  });
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || net));
  e.waitUntil(net.catch(() => {}));
});
