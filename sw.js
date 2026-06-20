const CACHE_NAME = 'abang-cache-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css?v=20260301',
    '/app.js?v=20260301-3',
    '/manifest.json',
    '/assets/abang_character.png',
    '/assets/icon-180.png',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
];

// Install Event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching assets');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request);
        })
    );
});
