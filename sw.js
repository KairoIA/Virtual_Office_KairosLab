/**
 * KAIROS Service Worker
 * Enables PWA install + offline caching of static assets
 */

const CACHE_NAME = 'kairos-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './css/assistant.css',
    './js/app.js',
    './js/storage.js',
    './js/calendar.js',
    './js/journal.js',
    './js/tasks.js',
    './js/search.js',
    './js/canvas.js',
    './js/assistant.js',
    './KairosLab_logo.png',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Don't cache API calls
    if (event.request.url.includes('/api/') || event.request.url.includes('/ws/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
