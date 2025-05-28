const APP_VERSION = '1.3.0'; // Synchronisé avec app.json
const CACHE_NAME = `inventory-app-cache-v${APP_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
];

// Configuration pour iOS
const iOS_CONFIG = {
  standalone: true,
  bounceBackDisabled: true,
  overscrollPreventionEnabled: true
};

// Variable pour tracker si une mise à jour est disponible
let updateAvailable = false;

// Précache lors de l'installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installation du service worker version:', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // Force l'activation immédiate du nouveau SW
        return self.skipWaiting();
      })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation du service worker version:', APP_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Nettoyage des anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Suppression du cache obsolète:', name);
              return caches.delete(name);
            })
        );
      }),
      // Prendre le contrôle de tous les clients
      self.clients.claim()
    ]).then(() => {
      // Notifier tous les clients qu'une mise à jour est disponible
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Stratégie de cache : Network First avec détection de mise à jour
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Gestion spéciale pour les requêtes de navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Vérifier si le manifest a changé (nouvelle version)
          if (event.request.url.includes('manifest.json')) {
            checkForUpdates(response.clone());
          }
          return response;
        })
        .catch(() => caches.match('/offline.html') || caches.match('/'))
    );
    return;
  }

  // Pour les autres ressources, utiliser Network First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Ne mettre en cache que les réponses valides
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cloner la réponse pour le cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Fallback sur le cache en cas d'échec réseau
        return caches.match(event.request);
      })
  );
});

// Fonction pour vérifier les mises à jour
async function checkForUpdates(manifestResponse) {
  try {
    const manifest = await manifestResponse.json();
    const currentVersion = manifest.version;
    
    if (currentVersion && currentVersion !== APP_VERSION) {
      console.log('[SW] Nouvelle version détectée:', currentVersion);
      updateAvailable = true;
      
      // Notifier tous les clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          currentVersion: APP_VERSION,
          newVersion: currentVersion
        });
      });
    }
  } catch (error) {
    console.error('[SW] Erreur lors de la vérification des mises à jour:', error);
  }
}

// Gestion des messages des clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Demande de mise à jour forcée reçue');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Vérifier manuellement les mises à jour
    fetch('/manifest.json')
      .then(response => checkForUpdates(response))
      .catch(error => console.error('[SW] Erreur lors de la vérification manuelle:', error));
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
  
  if (event.tag === 'check-updates') {
    event.waitUntil(
      fetch('/manifest.json')
        .then(response => checkForUpdates(response))
    );
  }
});

// Notifications push
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    tag: 'inventory-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification('Inventory App', options)
  );
});

// Fonction de synchronisation des données (à implémenter selon vos besoins)
async function syncData() {
  console.log('[SW] Synchronisation des données en arrière-plan');
  // Implémenter la logique de synchronisation ici
}