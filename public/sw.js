// Enhanced Service Worker for PWA (Network First for HTML & Runtime Cache for Assets)
const CACHE_NAME = 'haus-table-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache).catch(err => {
        console.warn('[SW] Precache skipped for some URLs:', err);
      }))
      .then(() => self.skipWaiting())
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Skip requests to other origins (like Instagram, Supabase, Facebook, Google)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // API & Supabase Requests: Network Only
  if (
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/functions/v1/') ||
    event.request.url.includes('/auth/v1/') ||
    event.request.url.includes('/storage/v1/')
  ) {
    return;
  }

  // HTML Navigation & Document Requests: Network First with index.html SPA Fallback
  const isHtmlRequest = 
    event.request.mode === 'navigate' || 
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isHtmlRequest) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedIndex) return cachedIndex;
          return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><p>Offline. Please check your network connection and reload.</p></body></html>', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Vite Hashed Assets (/assets/): Cache-First + Runtime Caching with MIME Protection
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          const contentType = cachedResponse.headers.get('content-type') || '';
          // Ensure cached response is not corrupt HTML
          if (!contentType.includes('text/html')) {
            return cachedResponse;
          }
          // Corrupt cache entry detected (HTML stored under asset URL) -> delete it
          caches.open(CACHE_NAME).then(cache => cache.delete(event.request));
        }

        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            // Only cache valid asset MIME types, NEVER text/html (which is SPA rewrite fallback)
            if (!contentType.includes('text/html')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
              return networkResponse;
            }
          }
          // If server returned text/html for an asset file (due to SPA rewrite 404 fallback) or 404,
          // do NOT serve HTML as JS! Return a 404 response so Vite / browser triggers chunk reload.
          return new Response('Asset not found', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' }
          });
        }).catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response('Network error loading asset', {
            status: 504,
            statusText: 'Gateway Timeout',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  // Other static resources: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse || new Response('Offline resource unavailable', {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'text/plain' }
        });
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notification Listeners
self.addEventListener('push', function(event) {
  let data = { title: 'New Order', body: 'Check Staff View', url: '/staff' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.log('Push data is not JSON:', event.data.text());
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-icon.png',
    badge: '/pwa-icon.png', 
    vibrate: [200, 100, 200, 100, 200],
    tag: 'new-order',
    renotify: true,
    data: {
      url: data.url || '/staff',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open App' },
    ],
    priority: 2, 
    visibility: 1
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      const urlToOpen = new URL(event.notification.data.url || '/staff', self.location.origin).href;
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if (client.url !== urlToOpen) {
            return client.navigate(urlToOpen).then(c => c.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow)
        return clients.openWindow(urlToOpen);
    })
  );
});
