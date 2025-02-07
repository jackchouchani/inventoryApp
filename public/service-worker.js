const CACHE_NAME = 'inventory-app-v1';
const OFFLINE_URL = '/offline.html';

const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  // '/static/js/main.js',
  // '/static/css/main.css',
  // '/favicon.ico',
  // '/icon-192.png',
  // '/icon-512.png',
  '/offline.html'
];

// Précache lors de l'installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_RESOURCES))
  );
});

// Stratégie de cache : Network First avec fallback sur le cache
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response; // Retourne la réponse du cache si elle existe
          }
          return fetch(event.request)
            .then((response) => {
              if (!response || response.status !== 200) {
                return response;
              }
              // Mettre en cache la nouvelle ressource
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              return response;
            })
            .catch(() => {
              return caches.match('/offline.html');
            });
        })
    );
  }
});

// Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Notifications push
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    // icon: '/icon-192.png',
    // badge: '/icon-192.png',
    vibrate: [100, 50, 100]
  };
  
  event.waitUntil(
    self.registration.showNotification('Inventory App', options)
  );
});