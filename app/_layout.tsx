import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, Platform, Text } from "react-native";
import { Slot, SplashScreen, router, useSegments } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { DataLoader } from '../src/components/DataLoader';
import UpdateNotification from '../src/components/UpdateNotification';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, useAppTheme } from '../src/contexts/ThemeContext';
import { usePWAServiceWorker } from '../src/hooks/usePWALifecycle';

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
  const { isAppReactivated, reactivationCount, isServiceWorkerReady, lastReactivation } = usePWAServiceWorker({
    onDataRefreshNeeded: () => {
      // Auto-refresh des données critiques après réactivation PWA
      console.log('🔄 Refresh automatique des données après réactivation PWA');
      try {
        store.dispatch({ type: 'items/fetchItems', payload: { page: 0, limit: 50 } });
        store.dispatch({ type: 'categories/fetchCategories' });
        store.dispatch({ type: 'containers/fetchContainers' });
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
    }, 100);
    
    return () => clearTimeout(timeout);
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
            {appIsReady ? <RootLayoutContent /> : <InitialLoadingScreen />}
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
  user: any;
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
  
  // Utilisation d'une référence pour stocker l'état précédent et éviter les redirections en boucle
  const prevStateRef = useRef<PrevStateRefType>({ 
    user: null, 
    segment: null,
    isRedirecting: false,
    initialCheckDone: false,
    mounted: false
  });
  
  // Marquer le composant comme monté
  useEffect(() => {
    prevStateRef.current.mounted = true;
    
    return () => {
      prevStateRef.current.mounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Timeout de sécurité pour éviter les blocages de chargement
  useEffect(() => {
    if (isLoading && !forceReady) {
      // Timeout de 10 secondes pour forcer la sortie du loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('⚠️ Timeout de chargement atteint, forçage de l\'état ready');
        setForceReady(true);
        
        // Essayer de recharger la page en dernier recours
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          console.log('🔄 Rechargement forcé de la page après timeout');
          window.location.reload();
        }
      }, 10000);
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

  // Fonction de redirection sécurisée
  const safeNavigate = useCallback((route: string) => {
    // Ne pas naviguer si le composant n'est pas monté
    if (!prevStateRef.current.mounted) {
      console.log('Tentative de navigation avant montage, annulée');
      return;
    }
    
    // Protection contre les redirections multiples
    if (prevStateRef.current.isRedirecting) {
      console.log('Déjà en redirection, requête ignorée');
      return;
    }
    
    // Protection contre les redirections vers la route actuelle
    const currentPath = router.canGoBack() ? segments.join('/') : '';
    if (currentPath === route.replace(/^\//, '')) {
      console.log('Déjà sur la route demandée:', route);
      return;
    }
    
    console.log('Navigation vers:', route);
    prevStateRef.current.isRedirecting = true;
    
    // Exécuter la navigation après un court délai pour éviter les conflits
    setTimeout(() => {
      try {
        router.replace(route);
      } catch (error) {
        console.error('Erreur de navigation:', error);
      }
      
      // Réinitialiser le flag après la navigation
      setTimeout(() => {
        prevStateRef.current.isRedirecting = false;
      }, 500);
    }, 150);
  }, [segments]);

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

  // Gérer les redirections uniquement quand tout est prêt
  useEffect(() => {
    // Ne rien faire si pas prêt
    if ((isLoading && !forceReady) || !isReady || !prevStateRef.current.mounted) {
      return;
    }
    
    // Timeout pour laisser le temps au montage complet
    const timeoutId = setTimeout(() => {
      // Mettre à jour les valeurs de référence
      const currentSegment = segments[0];
      const userChanged = prevStateRef.current.user !== user;
      const segmentChanged = prevStateRef.current.segment !== currentSegment;
      const initialCheck = !prevStateRef.current.initialCheckDone;
      
      // Enregistrer l'état actuel
      prevStateRef.current.user = user;
      prevStateRef.current.segment = currentSegment;
      
      // Si c'est la vérification initiale, marquer comme fait
      if (initialCheck) {
        prevStateRef.current.initialCheckDone = true;
        
        // Forcer une redirection initiale selon la connexion
        if (!user) {
          console.log('Redirection initiale vers login');
          safeNavigate('/(auth)/login');
          return;
        } else {
          console.log('Redirection initiale vers stock');
          safeNavigate('/(tabs)/stock');
          return;
        }
      }
      
      // Ne continuer que si l'état a changé
      if (!userChanged && !segmentChanged) {
        return;
      }
      
      // Obtenir le groupe de navigation actuel
      const inAuthGroup = currentSegment === '(auth)';
      const inStackGroup = currentSegment === '(stack)';
      const inTabsGroup = currentSegment === '(tabs)';
      const inRootRoute = !currentSegment || currentSegment === '';
      
      console.log('État changé - Segment:', currentSegment, 'User:', !!user);
      
      // Logique de redirection
      if (!user) {
        // Non connecté
        if (inRootRoute || inTabsGroup || inStackGroup) {
          console.log('Non connecté, redirection vers login');
          safeNavigate('/(auth)/login');
        }
      } else {
        // Connecté
        if (inAuthGroup || inRootRoute) {
          console.log('Connecté, redirection vers stock');
          safeNavigate('/(tabs)/stock');
        }
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [user, segments, isLoading, isReady, forceReady, safeNavigate]);

  // Afficher un loader pendant le chargement initial
  if ((isLoading && !forceReady) || !isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        {appWasHidden && (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: activeTheme.text.secondary, fontSize: 14 }}>
              Synchronisation en cours...
            </Text>
            {reactivationCount > 0 && (
              <Text style={{ color: activeTheme.text.secondary, fontSize: 12, marginTop: 4 }}>
                Réactivation #{reactivationCount}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // Rendre le contenu principal
  return (
    <View style={{ flex: 1, backgroundColor: activeTheme.background }}>
      {user ? (
        <DataLoader>
          <Slot />
        </DataLoader>
      ) : (
        <Slot />
      )}
    </View>
  );
}