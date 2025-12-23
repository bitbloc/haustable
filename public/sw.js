// Enhanced Service Worker for PWA (Network First for HTML)
const CACHE_NAME = 'haus-table-v2'; // Bump version
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
      .then(() => self.skipWaiting()) // Force activation
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
            // Delete old caches (v1, etc.)
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

self.addEventListener('fetch', event => {
    // API Requests: Network Only (or Network First) - managed by app mostly
    if (event.request.url.includes('/rest/v1/')) {
        return; 
    }

    // HTML Navigation: Network First!
    // This prevents serving stale index.html which links to old JS hashes
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // Static Assets (JS, CSS, Images): Cache First -> Network
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

// Push Notification Listeners
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/pwa-icon.png',
      badge: '/pwa-icon.png', // Android specific
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url
      },
      actions: [
        {
            action: 'explore', 
            title: 'View Details',
            icon: '/check-solid.png'
        },
        { 
            action: 'close', 
            title: 'Close',
            icon: '/cross-solid.png'
        },
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({
      type: 'window'
    }).then(function(clientList) {
      const urlToOpen = event.notification.data.url || '/staff';
      
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client)
          return client.focus();
      }
      // Otherwise open a new window
      if (clients.openWindow)
        return clients.openWindow(urlToOpen);
    })
  );
});
