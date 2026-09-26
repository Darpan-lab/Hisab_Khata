const CACHE_NAME = 'hisab-khata-cache-v8';
const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png?v=6',
  '/logo.png',
  '/icon-192.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches and reload clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
      .then(() => {
        // Broadcast version update to all active browser windows
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'VERSION_UPDATE' });
          });
        });
      })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Do not intercept non-GET requests, or Chrome extensions, or backend API calls
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin) ||
    requestUrl.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Handle SPA routing: if requesting a page, serve index.html from cache
  if (
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      caches.match('/index.html').then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for all other static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('SW fetch failed (probably offline):', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Event Listener for Web Push Notifications
self.addEventListener('push', (event) => {
  let payload = {
    notification: {
      title: 'Hisab Khata',
      body: 'New activity in your shared group!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: '/' }
    }
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = {
        notification: {
          title: 'Hisab Khata',
          body: event.data.text(),
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/' }
        }
      };
    }
  }

  const options = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192.png',
    badge: payload.notification.badge || '/icon-192.png',
    vibrate: payload.notification.vibrate || [100, 50, 100],
    data: payload.notification.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(payload.notification.title, options)
  );
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find if there's already a window open with this domain
      for (const client of clientList) {
        if ('focus' in client) {
          // Send user to targetUrl or just focus the window
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
