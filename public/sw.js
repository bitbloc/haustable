// Enhanced Service Worker for PWA (Network First for HTML & Runtime Cache for Assets)
const CACHE_NAME = 'haus-table-v4';
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

  // HTML Navigation: Network First
  // Prevents serving stale index.html which links to old JS hashes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Vite Hashed Assets (/assets/): Cache-First + Runtime Caching
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
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
      }).catch(() => cachedResponse);

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
