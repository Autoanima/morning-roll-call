// 早自習點名簿 Service Worker
// 策略:「網路優先,離線才用快取」——每次都先嘗試連網路抓最新版本,
// 只有在真的沒有網路時才回退到之前快取過的版本。
// 這樣重新整理(或重新打開App)時,只要有網路就一定拿到最新版本,
// 不會像過去的「快取優先」策略一樣被舊版卡住。

const CACHE_NAME = 'attendance-cache-v1';

// 開機時預先快取這些檔案,做為離線時的備援內容。
// 路徑用相對路徑,避免部署在子路徑(例如 GitHub Pages 的 /repo-name/)時失效。
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './easter-egg.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只處理「同源的 GET 請求」。
  // 跨網域的請求(例如 SheetJS CDN、Google表單、Google試算表同步)完全不碰,
  // 讓瀏覽器照原本的方式直接處理,避免把這些功能弄壞。
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // cache:'no-store' 讓這次要求跳過瀏覽器本身的 HTTP 快取,
    // 確保真的是去網路上問一次「現在最新的內容是什麼」。
    fetch(req, { cache: 'no-store' }).then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseClone).catch(() => {});
        });
      }
      return networkResponse;
    }).catch(() => {
      // 網路連不上(離線)時,才回退用之前存過的版本。
      return caches.match(req).then((cached) => {
        if (cached) return cached;
        return caches.match('./index.html');
      });
    })
  );
});
