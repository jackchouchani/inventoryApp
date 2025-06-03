import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface ServiceWorkerMessage {
  type: string;
  [key: string]: any;
}

interface UsePWAServiceWorkerReturn {
  isServiceWorkerReady: boolean;
  sendMessage: (message: ServiceWorkerMessage) => void;
  lastReactivation: Date | null;
}

export const usePWAServiceWorker = (): UsePWAServiceWorkerReturn => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [lastReactivation, setLastReactivation] = useState<Date | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const serviceWorkerRef = useRef<ServiceWorker | null>(null);

  // Fonction pour envoyer un message au service worker
  const sendMessage = (message: ServiceWorkerMessage) => {
    if (Platform.OS !== 'web' || !serviceWorkerRef.current) {
      return;
    }

    try {
      serviceWorkerRef.current.postMessage(message);
    } catch (error) {
      console.error('[PWA] Erreur envoi message SW:', error);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const setupServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // Attendre l'enregistrement du service worker
          const registration = await navigator.serviceWorker.ready;
          
          if (registration.active) {
            serviceWorkerRef.current = registration.active;
            setIsServiceWorkerReady(true);
            console.log('[PWA] Service Worker connecté et prêt');
          }

          // Écouter les messages du service worker
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

          // Envoyer un heartbeat régulier
          startHeartbeat();

        } catch (error) {
          console.error('[PWA] Erreur configuration Service Worker:', error);
        }
      }
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { type, ...data } = event.data;

      switch (type) {
        case 'APP_REACTIVATED':
          console.log('[PWA] App réactivée détectée par SW');
          setLastReactivation(new Date());
          
          // Déclencher un événement custom pour que l'app puisse réagir
          window.dispatchEvent(new CustomEvent('pwa-reactivated', {
            detail: { lastActiveTime: data.lastActiveTime, timestamp: data.timestamp }
          }));
          break;

        case 'UPDATE_AVAILABLE':
          console.log('[PWA] Mise à jour disponible:', data);
          window.dispatchEvent(new CustomEvent('pwa-update-available', {
            detail: data
          }));
          break;

        case 'SW_UPDATED':
          console.log('[PWA] Service Worker mis à jour:', data.version);
          break;

        default:
          console.log('[PWA] Message SW non géré:', type, data);
      }
    };

    const startHeartbeat = () => {
      // Envoyer un heartbeat toutes les 30 secondes
      heartbeatIntervalRef.current = setInterval(() => {
        sendMessage({ type: 'HEARTBEAT' });
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App devient invisible
        sendMessage({ type: 'APP_SUSPENDED' });
        console.log('[PWA] App suspendue notifiée au SW');
      } else {
        // App redevient visible
        console.log('[PWA] App redevient visible');
        
        // Relancer le heartbeat si nécessaire
        if (!heartbeatIntervalRef.current) {
          startHeartbeat();
        }
      }
    };

    const handlePageHide = () => {
      sendMessage({ type: 'APP_SUSPENDED' });
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }
    };

    const handlePageShow = () => {
      console.log('[PWA] Page show event');
      if (!heartbeatIntervalRef.current) {
        startHeartbeat();
      }
    };

    // Configurer les listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    // Initialiser le service worker
    setupServiceWorker();

    return () => {
      // Nettoyage
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      
      if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  return {
    isServiceWorkerReady,
    sendMessage,
    lastReactivation
  };
}; 