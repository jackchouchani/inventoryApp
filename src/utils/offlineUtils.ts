// Utilitaire pour vérifier l'état offline sans passer par Redux
// Accède directement aux APIs natives et au localStorage

export const isOfflineMode = (): boolean => {
  try {
    // 1. Vérifier le réseau natif
    const isNetworkOffline = typeof window !== 'undefined' && !navigator.onLine;
    
    // 2. Vérifier le mode offline forcé depuis localStorage (utilisé par NetworkContext)
    const offlineModeKey = '@offline_mode_forced';
    const savedMode = localStorage.getItem(offlineModeKey);
    const isOfflineModeForced = savedMode ? JSON.parse(savedMode) === true : false;
    
    const isOffline = isNetworkOffline || isOfflineModeForced;
    
    console.log('[offlineUtils] Mode offline check - Network:', isNetworkOffline, 'Forced:', isOfflineModeForced, 'Final:', isOffline);
    
    return isOffline;
  } catch (error) {
    console.error('[offlineUtils] Erreur lors de la vérification offline:', error);
    // En cas d'erreur, assumer qu'on est en ligne
    return false;
  }
};