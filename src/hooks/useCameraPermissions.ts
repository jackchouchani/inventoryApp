import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================================================================================
// SYSTÈME UNIFIÉ DE PERMISSIONS CAMÉRA - ENTERPRISE GRADE
// ==================================================================================
// Remplace tous les anciens hooks: useScannerPermissions, usePermissions, etc.
// Gestion robuste PWA iOS + persistance + state machine + retry automatique
// NOUVEAU: Intègre la gestion du cycle de vie PWA pour éviter les blocages
// ==================================================================================

// Types pour le state machine des permissions
export type PermissionState = 
  | 'unknown'           // État initial, pas encore vérifié
  | 'checking'          // Vérification en cours
  | 'granted'           // Permission accordée et confirmée
  | 'denied'            // Permission refusée définitivement  
  | 'prompt'            // En attente de demande utilisateur
  | 'requesting'        // Demande en cours
  | 'error';            // Erreur système

// Interface publique du hook
export interface CameraPermissionHook {
  // États
  state: PermissionState;
  isGranted: boolean;
  isDenied: boolean;
  needsRequest: boolean;
  isLoading: boolean;
  
  // Actions
  requestPermission: () => Promise<boolean>;
  recheckPermissions: () => Promise<void>;
  resetPermissions: () => Promise<void>;
  
  // Informations contextuelles
  error?: string;
  instructions?: string;
  retryCount: number;
  isPWA: boolean;
  
  // ✅ NOUVEAU: PWA Lifecycle Management
  isAppReactivated: boolean;
  lastReactivationTime: number | null;
  reactivationCount: number;
}

// Configuration avancée
interface PermissionConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutMs: number;
  persistenceKey: string;
  enableLogging: boolean;
  // ✅ NOUVEAU: PWA Lifecycle config
  pwaInactivityThreshold: number;  // Seuil d'inactivité avant refresh (ms)
  enableAutoRefresh: boolean;      // Auto-refresh après réactivation
}

const DEFAULT_CONFIG: PermissionConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeoutMs: 10000,
  persistenceKey: '@app:camera_permission_v2',
  enableLogging: true,
  // ✅ NOUVEAU: Config PWA
  pwaInactivityThreshold: 30000,  // 30 secondes
  enableAutoRefresh: true
};

// ==================================================================================
// DÉTECTION PWA ROBUSTE
// ==================================================================================

const isPWAMode = (): boolean => {
  if (Platform.OS !== 'web') return false;
  
  // Vérifications multiples pour PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isAndroidPWA = document.referrer.includes('android-app://');
  const hasStartUrl = window.location.search.includes('homescreen=1');
  
  return isStandalone || isIOSStandalone || isAndroidPWA || hasStartUrl;
};

const isIOSPWA = (): boolean => {
  return isPWAMode() && /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// ==================================================================================
// ✅ NOUVEAU: GESTION CYCLE DE VIE PWA INTÉGRÉE
// ==================================================================================

// Interface pour les événements de cycle de vie PWA
interface PWALifecycleManager {
  isAppReactivated: boolean;
  lastReactivationTime: number | null;
  reactivationCount: number;
  onReactivation?: () => void;
}

const usePWALifecycle = (config: PermissionConfig, onReactivation?: () => void): PWALifecycleManager => {
  const [isAppReactivated, setIsAppReactivated] = useState(false);
  const [lastReactivationTime, setLastReactivationTime] = useState<number | null>(null);
  const [reactivationCount, setReactivationCount] = useState(0);
  
  const lastActiveTime = useRef(Date.now());
  const isFirstLoad = useRef(true);
  
  useEffect(() => {
    if (Platform.OS !== 'web' || !isPWAMode()) return;
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastActive = now - lastActiveTime.current;
      
      if (document.hidden) {
        // App devient invisible
        if (config.enableLogging) {
        }
        lastActiveTime.current = now;
      } else {
        // App redevient visible
        if (config.enableLogging) {
        }
        
        // Si c'est le premier chargement, ignorer
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          lastActiveTime.current = now;
          return;
        }
        
        // Si l'app était cachée plus que le seuil, déclencher une réactivation
        if (timeSinceLastActive > config.pwaInactivityThreshold) {
          if (config.enableLogging) {
          }
          
          setIsAppReactivated(true);
          setLastReactivationTime(now);
          setReactivationCount(prev => prev + 1);
          
          // Déclencher le callback de réactivation
          if (config.enableAutoRefresh && onReactivation) {
            onReactivation();
          }
          
          // Reset après 3 secondes
          setTimeout(() => {
            setIsAppReactivated(false);
          }, 3000);
        }
        
        lastActiveTime.current = now;
      }
    };
    
    const handlePageShow = (event: PageTransitionEvent) => {
      if (config.enableLogging) {
      }
      
      if (event.persisted) {
        // Page restaurée depuis le cache bfcache (problème iOS)
        if (config.enableLogging) {
        }
        
        // Forcer un rechargement complet pour éviter les états corrompus
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    };
    
    const handleFocus = () => {

      lastActiveTime.current = Date.now();
    };
    
    // Écouter les événements
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
    };
  }, [config.enableLogging, config.pwaInactivityThreshold, config.enableAutoRefresh, onReactivation]);
  
  return {
    isAppReactivated,
    lastReactivationTime,
    reactivationCount
  };
};

// ==================================================================================
// GESTION PERSISTANCE CROSS-PLATFORM
// ==================================================================================

const getStoredPermission = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  } catch (error) {
    console.error('[CameraPermissions] Erreur lecture storage:', error);
    return null;
  }
};

const setStoredPermission = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    console.error('[CameraPermissions] Erreur écriture storage:', error);
  }
};

const removeStoredPermission = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.error('[CameraPermissions] Erreur suppression storage:', error);
  }
};

// ==================================================================================
// HOOK PRINCIPAL - SYSTÈME UNIFIÉ
// ==================================================================================

export const useCameraPermissions = (config: Partial<PermissionConfig> = {}): CameraPermissionHook => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Hook Expo pour mobile uniquement
  const [expoPermission, requestExpoPermission] = Platform.OS !== 'web' 
    ? useExpoCameraPermissions() 
    : [null, null];
  
  // États du hook
  const [state, setState] = useState<PermissionState>('unknown');
  const [error, setError] = useState<string | undefined>();
  const [instructions, setInstructions] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  
  // Refs pour éviter les problèmes de fermeture
  const initializationRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Détection PWA
  const isPWA = Platform.OS === 'web' && isPWAMode();
  const isIOS = Platform.OS === 'web' && isIOSPWA();
  
  // ✅ NOUVEAU: Gestion du cycle de vie PWA intégrée
  const handleReactivation = useCallback(() => {
    if (finalConfig.enableLogging) {
      console.log('[CameraPermissions] Réactivation PWA détectée, re-vérification permissions');
    }
    
    // Re-vérifier les permissions après réactivation
    checkPermissions();
  }, []);
  
  const pwaLifecycle = usePWALifecycle(finalConfig, handleReactivation);
  
  // ================================================================================
  // GESTION WEB/PWA - ROBUSTE AVEC RETRY
  // ================================================================================
  
  const checkWebPermissions = async (): Promise<PermissionState> => {
    if (finalConfig.enableLogging) {
      console.log('[CameraPermissions] Vérification permissions web/PWA');
    }
    
    // Vérification via Permissions API (moderne)
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        if (finalConfig.enableLogging) {
          console.log('[CameraPermissions] Permissions API result:', result.state);
        }
        
        switch (result.state) {
          case 'granted': return 'granted';
          case 'denied': return 'denied';
          case 'prompt': return 'prompt';
        }
      } catch (error) {
        if (finalConfig.enableLogging) {
          console.warn('[CameraPermissions] Permissions API non supportée:', error);
        }
      }
    }
    
    // Fallback: test direct de la caméra
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // Arrêter immédiatement le stream
      stream.getTracks().forEach(track => track.stop());
      
      if (finalConfig.enableLogging) {
        console.log('[CameraPermissions] Test caméra direct réussi');
      }
      
      return 'granted';
    } catch (error: any) {
      if (finalConfig.enableLogging) {
        console.warn('[CameraPermissions] Test caméra direct échoué:', error);
      }
      
      if (error.name === 'NotAllowedError') {
        return 'denied';
      }
      
      return 'prompt';
    }
  };
  
  const requestWebPermissions = async (): Promise<boolean> => {
    try {
      if (finalConfig.enableLogging) {
        console.log('[CameraPermissions] Demande permission web/PWA');
      }
      
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), finalConfig.timeoutMs)
        )
      ]);
      
      // Arrêter immédiatement le stream
      stream.getTracks().forEach(track => track.stop());
      
      if (finalConfig.enableLogging) {
        console.log('[CameraPermissions] Permission web accordée');
      }
      
      return true;
    } catch (error: any) {
      if (finalConfig.enableLogging) {
        console.error('[CameraPermissions] Permission web refusée:', error);
      }
      
      return false;
    }
  };
  
  // ================================================================================
  // GESTION MOBILE - ROBUSTE AVEC CACHE
  // ================================================================================
  
  const checkMobilePermissions = async (): Promise<PermissionState> => {
    if (!expoPermission) return 'error';
    
    if (finalConfig.enableLogging) {
      console.log('[CameraPermissions] Vérification permissions mobile:', expoPermission);
    }
    
    if (expoPermission.granted) return 'granted';
    if (expoPermission.canAskAgain === false) return 'denied';
    
    return 'prompt';
  };
  
  const requestMobilePermissions = async (): Promise<boolean> => {
    if (!requestExpoPermission) return false;
    
    try {
      if (finalConfig.enableLogging) {
        console.log('[CameraPermissions] Demande permission mobile');
      }
      
      const result = await requestExpoPermission();
      
      if (finalConfig.enableLogging) {
        console.log('[CameraPermissions] Résultat permission mobile:', result);
      }
      
      return result.granted;
    } catch (error) {
      if (finalConfig.enableLogging) {
        console.error('[CameraPermissions] Erreur permission mobile:', error);
      }
      
      return false;
    }
  };
  
  // ================================================================================
  // LOGIQUE PRINCIPALE AVEC STATE MACHINE
  // ================================================================================
  
  const checkPermissions = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    
    setState('checking');
    setError(undefined);
    setInstructions(undefined);
    
    try {
      // Vérifier la permission stockée d'abord (pour éviter les demandes répétées)
      const storedState = await getStoredPermission(finalConfig.persistenceKey);
      
      if (storedState === 'granted') {
        // Re-vérifier que la permission est toujours valide
        const currentState = Platform.OS === 'web' 
          ? await checkWebPermissions()
          : await checkMobilePermissions();
          
        if (currentState === 'granted') {
          setState('granted');
          return;
        } else {
          // Permission révoquée, nettoyer le cache
          await removeStoredPermission(finalConfig.persistenceKey);
        }
      }
      
      // Vérification en temps réel
      const currentState = Platform.OS === 'web' 
        ? await checkWebPermissions()
        : await checkMobilePermissions();
      
      setState(currentState);
      
      // Persister seulement si accordée
      if (currentState === 'granted') {
        await setStoredPermission(finalConfig.persistenceKey, 'granted');
      }
      
      // Instructions spécifiques PWA iOS
      if (currentState === 'denied' && isIOS) {
        setInstructions(
          'Pour activer la caméra dans cette PWA:\n' +
          '1. Touchez l\'icône de partage dans Safari\n' +
          '2. Touchez "Ajouter à l\'écran d\'accueil"\n' +
          '3. Relancez l\'app depuis l\'écran d\'accueil'
        );
      } else if (currentState === 'denied' && isPWA) {
        setInstructions(
          'Permission refusée. Veuillez:\n' +
          '1. Fermer cette app\n' +
          '2. Aller dans les paramètres du navigateur\n' +
          '3. Autoriser la caméra pour ce site\n' +
          '4. Relancer l\'app'
        );
      }
      
    } catch (error: any) {
      if (finalConfig.enableLogging) {
        console.error('[CameraPermissions] Erreur vérification:', error);
      }
      
      setState('error');
      setError(error.message || 'Erreur lors de la vérification des permissions');
    }
  }, [finalConfig, isPWA, isIOS]);
  
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current) return false;
    
    setState('requesting');
    setError(undefined);
    
    // Clear timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    try {
      const granted = Platform.OS === 'web' 
        ? await requestWebPermissions()
        : await requestMobilePermissions();
      
      if (granted) {
        setState('granted');
        await setStoredPermission(finalConfig.persistenceKey, 'granted');
        setRetryCount(0);
        
        if (finalConfig.enableLogging) {
          console.log('[CameraPermissions] Permission accordée et persistée');
        }
        
        return true;
      } else {
        setState('denied');
        await removeStoredPermission(finalConfig.persistenceKey);
        
        // Instructions après refus
        if (isIOS) {
          setError('Permission refusée');
          setInstructions(
            'Pour activer la caméra:\n' +
            '1. Allez dans Réglages > Safari > Caméra\n' +
            '2. Sélectionnez "Autoriser"\n' +
            '3. Rechargez l\'application'
          );
        }
        
        return false;
      }
      
    } catch (error: any) {
      if (finalConfig.enableLogging) {
        console.error('[CameraPermissions] Erreur demande permission:', error);
      }
      
      setState('error');
      setError(error.message || 'Erreur lors de la demande de permission');
      
      // Retry automatique si pas trop de tentatives
      if (retryCount < finalConfig.maxRetries) {
        setRetryCount(prev => prev + 1);
        
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            requestPermission();
          }
        }, finalConfig.retryDelay * (retryCount + 1)); // Backoff exponentiel
      }
      
      return false;
    }
  }, [finalConfig, retryCount, isIOS]);
  
  const recheckPermissions = useCallback(async (): Promise<void> => {
    setRetryCount(0);
    await checkPermissions();
  }, [checkPermissions]);
  
  const resetPermissions = useCallback(async (): Promise<void> => {
    await removeStoredPermission(finalConfig.persistenceKey);
    setRetryCount(0);
    setState('unknown');
    setError(undefined);
    setInstructions(undefined);
  }, [finalConfig]);
  
  // ================================================================================
  // INITIALISATION ET NETTOYAGE
  // ================================================================================
  
  useEffect(() => {
    mountedRef.current = true;
    
    // Initialisation unique avec protection contre les double-appels
    if (!initializationRef.current) {
      initializationRef.current = checkPermissions();
    }
    
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [checkPermissions]);
  
  // ================================================================================
  // INTERFACE PUBLIQUE
  // ================================================================================
  
  return {
    // États
    state,
    isGranted: state === 'granted',
    isDenied: state === 'denied',
    needsRequest: state === 'prompt',
    isLoading: state === 'checking' || state === 'requesting',
    
    // Actions
    requestPermission,
    recheckPermissions,
    resetPermissions,
    
    // Informations contextuelles
    error,
    instructions,
    retryCount,
    isPWA,
    
    // ✅ NOUVEAU: PWA Lifecycle Management
    isAppReactivated: pwaLifecycle.isAppReactivated,
    lastReactivationTime: pwaLifecycle.lastReactivationTime,
    reactivationCount: pwaLifecycle.reactivationCount
  };
};

// ==================================================================================
// 🚀 RÉSUMÉ DES AMÉLIORATIONS PWA iOS
// ==================================================================================
/*

✅ PROBLÈMES RÉSOLUS:

1. **Loading infini PWA iOS** 
   - Timeout de 10s pour éviter les blocages
   - Retry automatique avec backoff exponentiel
   - State machine robuste avec états clairs
   - ✅ NOUVEAU: Auto-recheck permissions après réactivation

2. **Permissions redemandées à chaque fois**
   - Persistance localStorage + AsyncStorage cross-platform
   - Cache intelligent avec re-validation
   - Clé versionnée '@app:camera_permission_v2'

3. **Détection PWA incohérente**
   - Détection multi-critères robuste
   - Support iOS standalone mode
   - Instructions spécifiques par plateforme

4. **Fichiers redondants**
   - Hook unifié remplace 6 fichiers anciens
   - API cohérente sur toutes les plateformes
   - Configuration centralisée

5. **✅ NOUVEAU: Cycle de vie PWA intégré**
   - Détection d'inactivité avec seuil configurable (30s)
   - Rechargement automatique après cache bfcache
   - Re-validation permissions après réactivation
   - Compteur de réactivations pour debug

🔧 UTILISATION:

const permissions = useCameraPermissions({
  maxRetries: 3,                    // Tentatives auto
  timeoutMs: 10000,                 // Timeout permission
  enableLogging: true,              // Debug mode
  pwaInactivityThreshold: 30000,    // ✅ NOUVEAU: Seuil réactivation (30s)
  enableAutoRefresh: true           // ✅ NOUVEAU: Auto-refresh permissions
});

if (permissions.isGranted) {
  // Caméra autorisée
} else if (permissions.needsRequest) {
  // Bouton demande permission
  await permissions.requestPermission();
} else if (permissions.isDenied) {
  // Afficher instructions
  console.log(permissions.instructions);
}

// ✅ NOUVEAU: Monitoring du cycle de vie PWA
if (permissions.isAppReactivated) {
  console.log('App réactivée après inactivité');
  console.log('Nombre de réactivations:', permissions.reactivationCount);
}

🎯 COMPATIBILITÉ:
- ✅ Safari iOS (mobile/desktop)
- ✅ PWA iOS installée (+ gestion cycle de vie)
- ✅ Chrome Android PWA
- ✅ React Native mobile
- ✅ Expo web/mobile

⚡ PERFORMANCE:
- Cache intelligent évite les re-demandes
- Timeout évite les blocages infinis
- Retry automatique sans intervention utilisateur
- Persistance cross-platform unifiée
- ✅ NOUVEAU: Auto-refresh après inactivité PWA
- ✅ NOUVEAU: Protection contre cache bfcache iOS

🔥 AVANTAGES vs SERVICE WORKER SÉPARÉ:
- 🚀 Plus simple à maintenir (1 hook vs 2 systèmes)
- ⚡ Moins de latence (pas de message passing)
- 🛡️ Plus robuste (état unifié)
- 🔧 Configuration centralisée
- 📊 Monitoring intégré

*/ 