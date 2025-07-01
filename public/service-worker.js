const APP_VERSION = '1.8.0'; // Synchronisé avec app.json
const CACHE_NAME = `inventory-app-cache-v${APP_VERSION}`;
const IMAGES_CACHE = 'offline-images-v1';
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

// Variables pour tracker l'état de l'application
let updateAvailable = false;
let lastActiveTime = Date.now();
let isAppSuspended = false;

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
      // Nettoyage des anciens caches (garder le cache d'images)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== IMAGES_CACHE)
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

// Stratégie de cache : Network First avec gestion intelligente des images
self.addEventListener('fetch', (event) => {
  // Mettre à jour le timestamp d'activité
  lastActiveTime = Date.now();
  
  // Vérifier si l'app était suspendue
  if (isAppSuspended) {
    console.log('[SW] App réactivée après suspension, notification aux clients');
    isAppSuspended = false;
    notifyClientsOfReactivation();
  }

  const url = new URL(event.request.url);
  
  // **GESTION ROBUSTE DES IMAGES** - Solution principale pour l'offline
  if (url.hostname === 'images.comptoirvintage.com') {
    event.respondWith(handleImageRequest(event.request));
    return;
  }

  // Gestion spéciale pour les requêtes API offline (POST/PUT/DELETE)
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) {
    if (event.request.method !== 'GET') {
      event.respondWith(handleOfflineAPIRequest(event.request));
      return;
    }
  }

  // Ignorer les autres requêtes non GET
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

// **FONCTION ROBUSTE POUR LA GESTION DES IMAGES OFFLINE**
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGES_CACHE);
  
  try {
    // ✅ Normaliser l'URL en supprimant les paramètres cache-bust pour la recherche en cache
    const url = new URL(request.url);
    const cleanUrl = url.origin + url.pathname; // Supprimer tous les paramètres de requête
    const cleanRequest = new Request(cleanUrl, {
      method: request.method,
      headers: request.headers,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer
    });
    
    // 1. Chercher en cache d'abord avec l'URL nettoyée (Cache First pour les images)
    let cachedResponse = await cache.match(cleanRequest);
    if (!cachedResponse) {
      // Essayer aussi avec l'URL originale au cas où elle serait déjà en cache
      cachedResponse = await cache.match(request);
    }
    
    if (cachedResponse) {
      console.log('[SW] Image servie depuis le cache:', request.url);
      return cachedResponse;
    }
    
    // 2. Si pas en cache, télécharger depuis le réseau avec l'URL nettoyée
    console.log('[SW] Téléchargement image:', cleanUrl);
    const networkResponse = await fetch(cleanRequest, { 
      mode: 'no-cors',
      cache: 'default'
    });
    
    // 3. En mode no-cors, on ne peut pas vérifier response.ok, mais on peut vérifier le type
    if (networkResponse.type === 'opaque' || networkResponse.ok) {
      // ✅ Mettre en cache avec l'URL nettoyée pour éviter les doublons
      await cache.put(cleanRequest, networkResponse.clone());
      console.log('[SW] Image téléchargée et mise en cache (mode no-cors):', cleanUrl);
      return networkResponse;
    } else {
      throw new Error(`Réponse invalide: type=${networkResponse.type}, status=${networkResponse.status}`);
    }
    
  } catch (error) {
    console.error('[SW] Erreur téléchargement image:', request.url, error);
    
    // 4. En cas d'erreur, chercher encore en cache avec l'URL nettoyée (double vérification)
    let fallbackResponse = await cache.match(cleanRequest);
    if (!fallbackResponse) {
      fallbackResponse = await cache.match(request);
    }
    if (fallbackResponse) {
      console.log('[SW] Image fallback depuis le cache après erreur:', request.url);
      return fallbackResponse;
    }
    
    // 5. Essayer une dernière fois avec une requête CORS normale avec l'URL nettoyée
    try {
      console.log('[SW] Tentative CORS normale pour:', cleanUrl);
      const corsResponse = await fetch(cleanRequest);
      if (corsResponse.ok) {
        await cache.put(cleanRequest, corsResponse.clone());
        console.log('[SW] Image téléchargée via CORS:', cleanUrl);
        return corsResponse;
      }
    } catch (corsError) {
      console.log('[SW] CORS également échoué pour:', cleanUrl);
    }
    
    // 6. Si vraiment aucune image disponible, retourner une image placeholder
    return new Response(
      `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#666">Image indisponible</text>
      </svg>`,
      {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'max-age=86400'
        }
      }
    );
  }
}

// Fonction pour notifier les clients de la réactivation
async function notifyClientsOfReactivation() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'APP_REACTIVATED',
        lastActiveTime: lastActiveTime,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Erreur lors de la notification de réactivation:', error);
  }
}

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
  
  if (event.data && event.data.type === 'APP_SUSPENDED') {
    console.log('[SW] App marquée comme suspendue');
    isAppSuspended = true;
  }
  
  if (event.data && event.data.type === 'HEARTBEAT') {
    // Heartbeat des clients pour détecter la suspension
    lastActiveTime = Date.now();
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
  
  if (event.tag === 'app-reactivation') {
    event.waitUntil(handleAppReactivation());
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

// Queue pour stocker les requêtes offline
let offlineRequestQueue = [];
const OFFLINE_REQUESTS_STORE = 'offline-requests';

// Fonction de synchronisation des données
async function syncData() {
  console.log('[SW] Synchronisation des données en arrière-plan');
  
  try {
    // Récupérer les requêtes en attente depuis IndexedDB
    const requests = await getOfflineRequests();
    
    if (requests.length === 0) {
      console.log('[SW] Aucune requête offline en attente');
      return;
    }
    
    console.log(`[SW] Traitement de ${requests.length} requêtes offline`);
    
    for (const request of requests) {
      try {
        // Tenter de rejouer la requête
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        if (response.ok) {
          console.log('[SW] Requête offline synchronisée avec succès:', request.id);
          await removeOfflineRequest(request.id);
          
          // Notifier l'app du succès
          notifyClientsOfSync({
            type: 'SYNC_SUCCESS',
            requestId: request.id,
            timestamp: Date.now()
          });
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('[SW] Échec de synchronisation pour la requête:', request.id, error);
        
        // Incrémenter le compteur d'échecs
        request.retryCount = (request.retryCount || 0) + 1;
        
        if (request.retryCount >= 3) {
          console.log('[SW] Requête abandonnée après 3 tentatives:', request.id);
          await removeOfflineRequest(request.id);
          
          notifyClientsOfSync({
            type: 'SYNC_FAILED',
            requestId: request.id,
            error: error.message,
            timestamp: Date.now()
          });
        } else {
          await updateOfflineRequest(request);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Erreur lors de la synchronisation:', error);
  }
}

// Fonction pour gérer la réactivation de l'app
async function handleAppReactivation() {
  console.log('[SW] Gestion de la réactivation de l\'application');
  
  try {
    // Vérifier les mises à jour
    const manifestResponse = await fetch('/manifest.json');
    await checkForUpdates(manifestResponse);
    
    // Notifier les clients de la réactivation
    await notifyClientsOfReactivation();
    
  } catch (error) {
    console.error('[SW] Erreur lors de la gestion de réactivation:', error);
  }
}

// Timer pour détecter l'inactivité prolongée
setInterval(() => {
  const now = Date.now();
  const timeSinceLastActive = now - lastActiveTime;
  
  // Si plus de 5 minutes d'inactivité, marquer comme suspendu
  if (timeSinceLastActive > 300000 && !isAppSuspended) {
    console.log('[SW] Inactivité prolongée détectée, marquage comme suspendu');
    isAppSuspended = true;
  }
}, 60000); // Vérifier toutes les minutes


// Fonction pour gérer les requêtes API en mode offline
async function handleOfflineAPIRequest(request) {
  try {
    // Tenter la requête normalement d'abord
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Si la requête échoue (mode offline), la stocker pour plus tard
    console.log('[SW] Requête API en mode offline, stockage pour synchronisation:', request.url);
    
    const requestData = {
      id: generateRequestId(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now(),
      retryCount: 0
    };
    
    await saveOfflineRequest(requestData);
    
    // Programmer une synchronisation en arrière-plan
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      self.registration.sync.register('sync-data');
    }
    
    // Retourner une réponse simulée pour indiquer que la requête a été mise en queue
    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Requête mise en file d\'attente pour synchronisation',
      requestId: requestData.id
    }), {
      status: 202, // Accepted
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Fonctions utilitaires pour IndexedDB (requêtes offline)
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function saveOfflineRequest(requestData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineRequestsDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([OFFLINE_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(OFFLINE_REQUESTS_STORE);
      
      const addRequest = store.add(requestData);
      addRequest.onerror = () => reject(addRequest.error);
      addRequest.onsuccess = () => resolve(requestData.id);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_REQUESTS_STORE)) {
        const store = db.createObjectStore(OFFLINE_REQUESTS_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('retryCount', 'retryCount');
      }
    };
  });
}

async function getOfflineRequests() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineRequestsDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([OFFLINE_REQUESTS_STORE], 'readonly');
      const store = transaction.objectStore(OFFLINE_REQUESTS_STORE);
      
      const getAllRequest = store.getAll();
      getAllRequest.onerror = () => reject(getAllRequest.error);
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
    };
  });
}

async function removeOfflineRequest(requestId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineRequestsDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([OFFLINE_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(OFFLINE_REQUESTS_STORE);
      
      const deleteRequest = store.delete(requestId);
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
    };
  });
}

async function updateOfflineRequest(requestData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineRequestsDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([OFFLINE_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(OFFLINE_REQUESTS_STORE);
      
      const updateRequest = store.put(requestData);
      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve();
    };
  });
}

async function notifyClientsOfSync(data) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage(data);
    });
  } catch (error) {
    console.error('[SW] Erreur lors de la notification de sync:', error);
  }
}