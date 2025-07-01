import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, Platform, Text } from "react-native";
import { Slot, SplashScreen, router, useSegments } from "expo-router";
import { Provider } from "react-redux";
import { Provider as PaperProvider, Button } from "react-native-paper";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { NetworkProvider } from "../src/contexts/NetworkContext";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import UpdateNotification from '../src/components/UpdateNotification';
import OfflineIndicator from '../src/components/OfflineIndicator';
import ConflictNotificationBanner from '../src/components/ConflictNotificationBanner';
import * as Sentry from '@sentry/react-native';
import { isOfflineDownloadInProgress, subscribeToDownloadState } from '../src/services/OfflinePreparationService';
import { ThemeProvider, useAppTheme } from '../src/contexts/ThemeContext';
import { usePWAServiceWorker } from '../src/hooks/usePWALifecycle';
import { fetchItems } from '../src/store/itemsThunks';
import { fetchCategories } from '../src/store/categoriesThunks';
import { fetchContainers } from '../src/store/containersThunks';
import { fetchLocations } from '../src/store/locationsThunks';
import { conflictNotificationService } from '../src/services/ConflictNotificationService';

// Empêcher le masquage automatique du splash screen
SplashScreen.preventAutoHideAsync();

// Configuration des toasts
const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#4CAF50' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#FF3B30' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600' }}
      text2Style={{ fontSize: 14 }}
    />
  )
};

// Hook pour gérer le cycle de vie PWA - VERSION SIMPLIFIÉE
function usePWALifecycle() {
  const { isAppReactivated, reactivationCount } = usePWAServiceWorker({
    onDataRefreshNeeded: () => {
      // Auto-refresh des données critiques après réactivation PWA
      console.log('🔄 Refresh automatique des données après réactivation PWA');
      try {
        // ✅ OFFLINE - Charger TOUS les items après réactivation pour éviter la perte de données
        store.dispatch(fetchItems({ page: 0, limit: 50000 })); // Grande limite pour restaurer tous les items
        store.dispatch(fetchCategories());
        store.dispatch(fetchContainers());
        store.dispatch(fetchLocations());
      } catch (error) {
        console.error('Erreur lors du refresh automatique:', error);
      }
    }
  });

  // ✅ Plus besoin de logique complexe, le hook usePWAServiceWorker gère tout !
  
  return { 
    appWasHidden: isAppReactivated, 
    reactivationCount 
  };
}

// Root Layout avec providers essentiels
export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  // Attendre que l'application soit montée avant de faire quoi que ce soit
  useEffect(() => {
    // Marquer l'application comme prête après le premier rendu
    const timeout = setTimeout(() => {
      setAppIsReady(true);
      
      // Initialiser le service de notification de conflits
      conflictNotificationService.initialize({
        enableToasts: true,
        enablePersistentBanner: true,
        autoDetectionInterval: 60000, // 1 minute
        maxToastsPerSession: 5,
        onConflictDetected: (conflicts) => {
          console.log(`🔔 ${conflicts.length} conflits détectés`);
        },
        onConflictResolved: (conflictId) => {
          console.log(`✅ Conflit ${conflictId} résolu`);
        }
      });
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      // Arrêter le service de notification au démontage
      conflictNotificationService.shutdown();
    };
  }, []);

  return (
    <ErrorBoundary
      onReset={() => {
        store.dispatch({ type: 'RESET_STATE' });
      }}
    >
      <Provider store={store}>
        <AuthProvider>
          <ThemeProvider>
            <PaperProvider>
              <NetworkProvider>
                {appIsReady ? <RootLayoutContent /> : <InitialLoadingScreen />}
                <OfflineIndicator />
                <ConflictNotificationBanner />
                <Toast config={toastConfig} />
                {Platform.OS === 'web' && (
                  <>
                    <div id="datepicker-portal"></div>
                    <UpdateNotification 
                      onUpdateAvailable={(version) => {
                        console.log('🔄 Nouvelle version PWA disponible:', version);
                        Sentry.addBreadcrumb({
                          message: `Mise à jour PWA disponible: ${version}`,
                          level: 'info',
                          category: 'pwa'
                        });
                      }}
                    />
                  </>
                )}
              </NetworkProvider>
            </PaperProvider>
          </ThemeProvider>
        </AuthProvider>
      </Provider>
    </ErrorBoundary>
  );
}

// Écran de chargement initial
function InitialLoadingScreen() {
  const { activeTheme } = useAppTheme();
  
  return (
    <View style={[{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={activeTheme.primary} />
    </View>
  );
}

// Type pour le state stocké dans la référence
type PrevStateRefType = {
  user: unknown;
  segment: string | null;
  isRedirecting: boolean;
  initialCheckDone: boolean;
  mounted: boolean;
};

// Composant interne pour la logique d'authentification
function RootLayoutContent() {
  const { user, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const { activeTheme } = useAppTheme();
  const { appWasHidden, reactivationCount } = usePWALifecycle();
  
  // Timeout de sécurité pour éviter les blocages infinis
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const [forceReady, setForceReady] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  
  // État de téléchargement offline pour bloquer intelligemment la navigation
  const [isOfflineDownloading, setIsOfflineDownloading] = useState(() => isOfflineDownloadInProgress());
  
  // Utilisation d'une référence pour stocker l'état précédent et éviter les redirections en boucle
  const prevStateRef = useRef<PrevStateRefType>({ 
    user: null, 
    segment: null,
    isRedirecting: false,
    initialCheckDone: false,
    mounted: false
  });
  
  // Marquer le composant comme monté et s'abonner aux changements de téléchargement
  useEffect(() => {
    prevStateRef.current.mounted = true;
    
    // S'abonner aux changements d'état de téléchargement
    const unsubscribe = subscribeToDownloadState((isDownloading) => {
      console.log('[Layout] État téléchargement changé:', isDownloading);
      // Mise à jour IMMÉDIATE avec setTimeout pour forcer la synchronisation
      setTimeout(() => {
        setIsOfflineDownloading(isDownloading);
        console.log('[Layout] isOfflineDownloading mis à jour:', isDownloading);
      }, 0);
    });
    
    return () => {
      const prevState = prevStateRef.current;
      prevState.mounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      unsubscribe(); // Se désabonner
    };
  }, []);

  // Timeout de sécurité pour éviter les blocages de chargement
  useEffect(() => {
    if (isLoading && !forceReady) {
      // Premier timeout à 8 secondes pour afficher le bouton refresh
      const refreshButtonTimeout = setTimeout(() => {
        console.warn('⚠️ Chargement long détecté, affichage du bouton refresh');
        setLoadingTimeout(true);
        setShowRefreshButton(true);
      }, 8000);
      
      // Deuxième timeout de 20 secondes pour forcer la sortie du loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('⚠️ Timeout de chargement critique atteint, forçage de l\'état ready');
        setForceReady(true);
      }, 20000);
      
      return () => {
        clearTimeout(refreshButtonTimeout);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      };
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = undefined;
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading, forceReady]);

  // Fonction pour forcer le refresh
  const handleForceRefresh = useCallback(() => {
    console.log('🔄 Refresh forcé par l\'utilisateur');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      // Pour mobile, forcer la sortie du loading
      setForceReady(true);
    }
  }, []);

  // Fonction de redirection SIMPLIFIÉE - moins de protection = moins de bugs
  const safeNavigate = useCallback((route: string) => {
    // Seulement une protection de base
    if (!prevStateRef.current.mounted) {
      console.log('Navigation avant montage, annulée');
      return;
    }
    
    console.log('Navigation simple vers:', route);
    try {
      // Navigation directe sans timeouts complexes
      router.replace(route);
    } catch (error) {
      console.error('Erreur de navigation:', error);
    }
  }, []);

  // Masquer le splash screen une fois prêt
  useEffect(() => {
    if (!isLoading || forceReady) {
      // Masquer le splash screen immédiatement
      const hideSplash = async () => {
        try {
          await SplashScreen.hideAsync();
        } catch (err) {
          console.error("Erreur lors du masquage du splash screen:", err);
          Sentry.captureException(err);
        } finally {
          // Attendre un court instant avant de marquer comme prêt
          setTimeout(() => {
            setIsReady(true);
          }, 100);
        }
      };
      
      hideSplash();
    }
  }, [isLoading, forceReady]);

  // Navigation intelligente - MOINS AGRESSIVE
  useEffect(() => {
    // Ne rien faire si pas prêt
    if ((isLoading && !forceReady) || !isReady || !prevStateRef.current.mounted) {
      return;
    }
    
    // Seulement quand l'utilisateur change (connexion/déconnexion) OU vérification initiale
    const userChanged = prevStateRef.current.user !== user;
    const initialCheck = !prevStateRef.current.initialCheckDone;
    
    if (!userChanged && !initialCheck) {
      // Si l'utilisateur n'a pas changé et qu'on a déjà fait la vérification initiale,
      // NE PAS forcer de redirection - respecter la navigation de l'utilisateur
      return;
    }
    
    // Mettre à jour l'état de référence
    prevStateRef.current.user = user;
    prevStateRef.current.initialCheckDone = true;
    
    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === '(auth)';
    const inRootRoute = !currentSegment || currentSegment === '';
    
    console.log('Navigation check - Segment:', currentSegment, 'User:', !!user, 'UserChanged:', userChanged, 'InitialCheck:', initialCheck);
    
    // EMPÊCHER la navigation pendant le téléchargement offline
    if (isOfflineDownloadInProgress()) {
      console.log('Téléchargement offline en cours, navigation bloquée');
      return;
    }
    
    // LOGIQUE ULTRA-SIMPLIFIÉE - respecter l'URL tapée par l'utilisateur
    if (!user) {
      // Non connecté - rediriger SEULEMENT si on est pas sur login
      if (!inAuthGroup) {
        console.log('Non connecté, redirection vers login');
        safeNavigate('/(auth)/login');
      }
    } else {
      // Connecté - rediriger SEULEMENT depuis root ou auth, PAS depuis les autres pages
      if (inRootRoute) {
        console.log('Connecté sur root, redirection vers stock');
        safeNavigate('/(tabs)/stock');
      } else if (inAuthGroup) {
        console.log('Connecté sur auth, redirection vers stock');
        safeNavigate('/(tabs)/stock');
      }
      // RESPECTER /settings, /stack, etc. - pas de redirection forcée
    }
  }, [user, isReady, forceReady, safeNavigate]); // MOINS de dépendances

  // Afficher un loader pendant le chargement initial
  console.log('🔍 [Layout] État de chargement - isLoading:', isLoading, 'isReady:', isReady, 'forceReady:', forceReady, 'isOfflineDownloading:', isOfflineDownloading);
  if ((isLoading && !forceReady) || !isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: activeTheme.text.primary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            {loadingTimeout ? 'Chargement en cours...' : 'Initialisation...'}
          </Text>
          
          {appWasHidden ? (
            <>
              <Text style={{ color: activeTheme.text.secondary, fontSize: 14, textAlign: 'center' }}>
                Synchronisation en cours...
              </Text>
              {reactivationCount > 0 && (
                <Text style={{ color: activeTheme.text.secondary, fontSize: 12, marginTop: 4 }}>
                  Réactivation #{reactivationCount}
                </Text>
              )}
            </>
          ) : loadingTimeout ? (
            <Text style={{ color: activeTheme.text.secondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              Le chargement prend plus de temps que prévu...
            </Text>
          ) : (
            <Text style={{ color: activeTheme.text.secondary, fontSize: 14, textAlign: 'center' }}>
              Chargement des données...
            </Text>
          )}
        </View>

        {showRefreshButton && (
          <View style={{ marginTop: 30, alignItems: 'center' }}>
            <Button
              mode="contained"
              onPress={handleForceRefresh}
              icon="refresh"
              style={{ marginBottom: 10 }}
            >
              Actualiser l'application
            </Button>
            <Text style={{ color: activeTheme.text.secondary, fontSize: 12, textAlign: 'center', maxWidth: 250 }}>
              Si le problème persiste, essayez de actualiser l'application ou vérifiez votre connexion internet.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Rendre le contenu principal
  return (
    <View style={{ flex: 1, backgroundColor: activeTheme.background }}>
      <Slot />
    </View>
  );
}