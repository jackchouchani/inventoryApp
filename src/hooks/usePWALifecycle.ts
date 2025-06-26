import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// ==================================================================================
// HOOK PWA LIFECYCLE - REMPLACE SERVICE WORKER 
// ==================================================================================
// Solution moderne pour résoudre les blocages PWA iOS
// Plus simple, plus robuste, plus maintenable que usePWAServiceWorker
// ==================================================================================

export interface PWALifecycleHook {
  // États
  isAppReactivated: boolean;
  isServiceWorkerReady: boolean;  // Compatible avec ancien API
  lastReactivation: Date | null;
  reactivationCount: number;
  
  // Actions
  sendMessage: (message: any) => void;  // Compatible avec ancien API
  forceRefresh: () => void;
  
  // Monitoring
  timeSinceLastActivity: number;
  isPWAMode: boolean;
  isIOSPWA: boolean;
}

interface PWAConfig {
  inactivityThreshold: number;     // Seuil d'inactivité en ms (défaut: 30s)
  enableAutoRefresh: boolean;      // Auto-refresh après réactivation
  enableLogging: boolean;          // Logs détaillés
  onReactivation?: () => void;     // Callback de réactivation
  onDataRefreshNeeded?: () => void; // Callback pour refresh des données
}

const DEFAULT_CONFIG: PWAConfig = {
  inactivityThreshold: 30000,      // 30 secondes
  enableAutoRefresh: true,
  enableLogging: true
};

// ==================================================================================
// UTILITAIRES DE DÉTECTION PWA
// ==================================================================================

const isPWAMode = (): boolean => {
  if (Platform.OS !== 'web') return false;
  
  // Détection robuste multi-critères
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isAndroidPWA = document.referrer.includes('android-app://');
  const hasStartUrl = window.location.search.includes('homescreen=1');
  const isInWebApp = window.location.search.includes('pwa=true');
  
  return isStandalone || isIOSStandalone || isAndroidPWA || hasStartUrl || isInWebApp;
};

const isIOSPWA = (): boolean => {
  return isPWAMode() && /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// ==================================================================================
// HOOK PRINCIPAL PWA LIFECYCLE
// ==================================================================================

export const usePWALifecycle = (config: Partial<PWAConfig> = {}): PWALifecycleHook => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // États
  const [isAppReactivated, setIsAppReactivated] = useState(false);
  const [lastReactivation, setLastReactivation] = useState<Date | null>(null);
  const [reactivationCount, setReactivationCount] = useState(0);
  const [timeSinceLastActivity, setTimeSinceLastActivity] = useState(0);
  
  // Refs pour éviter les problèmes de fermeture
  const lastActiveTime = useRef(Date.now());
  const isFirstLoad = useRef(true);
  const activityTimer = useRef<NodeJS.Timeout>();
  const reactivationTimer = useRef<NodeJS.Timeout>();
  
  // Constantes
  const isPWA = isPWAMode();
  const isIOS = isIOSPWA();
  
  // ================================================================================
  // GESTION DU TEMPS D'ACTIVITÉ
  // ================================================================================
  
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    // Timer pour mettre à jour le temps d'inactivité
    const updateActivityTimer = () => {
      const now = Date.now();
      setTimeSinceLastActivity(now - lastActiveTime.current);
    };
    
    // Mettre à jour toutes les secondes
    activityTimer.current = setInterval(updateActivityTimer, 1000);
    
    return () => {
      if (activityTimer.current) {
        clearInterval(activityTimer.current);
      }
    };
  }, []);
  
  // ================================================================================
  // GESTION DU CYCLE DE VIE PWA
  // ================================================================================
  
  const triggerReactivation = useCallback((reason: string) => {
    const now = new Date();
    

    setIsAppReactivated(true);
    setLastReactivation(now);
    setReactivationCount(prev => prev + 1);
    
    // Déclencher le callback de réactivation
    if (finalConfig.onReactivation) {
      finalConfig.onReactivation();
    }
    
    // Auto-refresh des données si activé
    if (finalConfig.enableAutoRefresh && finalConfig.onDataRefreshNeeded) {
      setTimeout(() => {
        finalConfig.onDataRefreshNeeded!();
      }, 1000);
    }
    
    // Reset du flag après 3 secondes
    if (reactivationTimer.current) {
      clearTimeout(reactivationTimer.current);
    }
    
    reactivationTimer.current = setTimeout(() => {
      setIsAppReactivated(false);
    }, 3000);
  }, [finalConfig]);
  
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastActive = now - lastActiveTime.current;
      
      if (document.hidden) {
        lastActiveTime.current = now;
      } else {

        
        // Ignorer le premier chargement
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          lastActiveTime.current = now;
          return;
        }
        
        // Si l'app était cachée plus que le seuil, déclencher une réactivation
        if (timeSinceLastActive > finalConfig.inactivityThreshold) {
          triggerReactivation(`inactivité ${Math.round(timeSinceLastActive / 1000)}s`);
        }
        
        lastActiveTime.current = now;
      }
    };
    
    const handlePageShow = (event: PageTransitionEvent) => {
      
      
      if (event.persisted) {
        // ⚠️ CRITIQUE: Page restaurée depuis le cache bfcache (problème iOS PWA)
        
        
        // Forcer un rechargement complet pour éviter les états corrompus
        setTimeout(() => {
          window.location.reload();
        }, 500);
        return;
      }
      
      // Page show normal (pas de cache)
      lastActiveTime.current = Date.now();
    };
    
    const handleFocus = () => {
      
      lastActiveTime.current = Date.now();
    };
    
    const handleBeforeUnload = () => {
      // Nettoyer avant fermeture
      
    };
    
    // ================================================================================
    // GESTION SPÉCIFIQUE PWA iOS
    // ================================================================================
    
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const touchDiff = touchY - touchStartY;
      
      // Empêcher le pull-to-refresh natif iOS qui peut causer des problèmes
      if (touchDiff > 0 && window.scrollY === 0) {
        e.preventDefault();
      }
    };
    
    // Écouter tous les événements
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Événements spécifiques iOS PWA
    if (isIOS) {
      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (isIOS) {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      }
      
      if (reactivationTimer.current) {
        clearTimeout(reactivationTimer.current);
      }
    };
  }, [finalConfig, triggerReactivation, isIOS]);
  
  // ================================================================================
  // ACTIONS PUBLIQUES
  // ================================================================================
  
  const sendMessage = useCallback((message: any) => {
    // Compatible avec l'ancien API usePWAServiceWorker
    
    // Dans notre cas, pas besoin de Service Worker, mais on garde la compatibilité
  }, [finalConfig.enableLogging]);
  
  const forceRefresh = useCallback(() => {
    
    
    triggerReactivation('refresh forcé');
  }, [triggerReactivation, finalConfig.enableLogging]);
  
  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (activityTimer.current) {
        clearInterval(activityTimer.current);
      }
      if (reactivationTimer.current) {
        clearTimeout(reactivationTimer.current);
      }
    };
  }, []);
  
  // ================================================================================
  // INTERFACE PUBLIQUE
  // ================================================================================
  
  return {
    // États
    isAppReactivated,
    isServiceWorkerReady: true,  // Toujours true (pas de SW nécessaire)
    lastReactivation,
    reactivationCount,
    
    // Actions
    sendMessage,
    forceRefresh,
    
    // Monitoring
    timeSinceLastActivity,
    isPWAMode: isPWA,
    isIOSPWA: isIOS
  };
};

// ==================================================================================
// 🎯 HOOK COMPATIBLE AVEC L'ANCIEN usePWAServiceWorker
// ==================================================================================

/**
 * Hook de compatibilité pour remplacer usePWAServiceWorker
 * sans casser le code existant.
 */
export const usePWAServiceWorker = (config?: {
  onReactivation?: () => void;
  onDataRefreshNeeded?: () => void;
}) => {
  return usePWALifecycle({
    enableLogging: true,
    enableAutoRefresh: true,
    inactivityThreshold: 30000,
    ...config
  });
}; 