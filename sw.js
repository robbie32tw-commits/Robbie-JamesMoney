const CACHE_NAME = 'abang-cache-v4';
// 相對路徑：SW 註冊在子路徑下(/Robbie-JamesMoney/)，相對路徑才會解析正確
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './assets/abang_character.png',
    './assets/icon-180.png',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

// Install：預先快取 app shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate：清掉舊版快取
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

// Fetch：network-first —— 線上一律拿最新版，離線才回退快取(適合即時同步的記帳 app)
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    event.respondWith(
        fetch(req).then(response => {
            // 僅快取本網域成功的 GET，避免快取雲端/第三方回應
            if (response.ok && new URL(req.url).origin === self.location.origin) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            }
            return response;
        }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
});
