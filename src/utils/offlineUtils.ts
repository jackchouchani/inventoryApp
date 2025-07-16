// Utilitaire pour vérifier l'état offline sans passer par Redux
// Accède directement aux APIs natives et au localStorage

import { Platform } from 'react-native';

export const isOfflineMode = (): boolean => {
  try {
    // Sur mobile, pas de mode offline - toujours en ligne
    if (Platform.OS !== 'web') {
      return false;
    }
    
    // 1. Vérifier le réseau natif (web seulement)
    const isNetworkOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    // 2. Vérifier le mode offline forcé depuis localStorage (utilisé par NetworkContext)
    const offlineModeKey = '@offline_mode_forced';
    let isOfflineModeForced = false;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedMode = window.localStorage.getItem(offlineModeKey);
        isOfflineModeForced = savedMode ? JSON.parse(savedMode) === true : false;
      } catch (e) {
        // Ignore localStorage errors
        isOfflineModeForced = false;
      }
    }
    
    const isOffline = isNetworkOffline || isOfflineModeForced;
    
    console.log('[offlineUtils] Mode offline check - Network:', isNetworkOffline, 'Forced:', isOfflineModeForced, 'Final:', isOffline);
    
    return isOffline;
  } catch (error) {
    console.error('[offlineUtils] Erreur lors de la vérification offline:', error);
    // En cas d'erreur, assumer qu'on est en ligne
    return false;
  }
};