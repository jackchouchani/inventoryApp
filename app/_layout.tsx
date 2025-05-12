import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Slot, SplashScreen, router, useSegments } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/config/queryClient';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { DataLoader } from '../src/components/DataLoader';
import * as Sentry from '@sentry/react-native';

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
        queryClient.clear();
        store.dispatch({ type: 'RESET_STATE' });
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <AuthProvider>
            {appIsReady ? <RootLayoutContent /> : <InitialLoadingScreen />}
            <Toast config={toastConfig} />
          </AuthProvider>
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Écran de chargement initial
function InitialLoadingScreen() {
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#007AFF" />
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
    };
  }, []);

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
    }, 150); // Légère augmentation du délai
  }, [segments]);

  // Masquer le splash screen une fois prêt
  useEffect(() => {
    if (!isLoading) {
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
  }, [isLoading]);

  // Gérer les redirections uniquement quand tout est prêt
  useEffect(() => {
    // Ne rien faire si pas prêt
    if (isLoading || !isReady || !prevStateRef.current.mounted) {
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
    }, 300); // Attendre 300ms pour être sûr que tout est bien monté
    
    return () => clearTimeout(timeoutId);
  }, [user, segments, isLoading, isReady, safeNavigate]);

  // Afficher un loader pendant le chargement initial
  if (isLoading || !isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Rendre le contenu principal
  return (
    <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  }
}); 