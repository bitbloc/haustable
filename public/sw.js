// Basic Service Worker for PWA (Offline Support)
const CACHE_NAME = 'haus-table-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
    // Basic Stale-while-revalidate for navigation
    // Network-first for API
    if (event.request.url.includes('/rest/v1/')) {
        // Supabase API: Network Only (or Network First)
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
