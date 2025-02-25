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
            <RootLayoutContent />
            <Toast config={toastConfig} />
          </AuthProvider>
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Type pour le state stocké dans la référence
type PrevStateRefType = {
  user: any;
  segment: string | null;
  isRedirecting: boolean;
  initialCheckDone: boolean;
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
    initialCheckDone: false
  });

  // Fonction de redirection sécurisée
  const safeNavigate = useCallback((route: string) => {
    if (prevStateRef.current.isRedirecting) return;
    
    prevStateRef.current.isRedirecting = true;
    
    // Exécuter la navigation après un court délai pour éviter les conflits
    setTimeout(() => {
      router.replace(route);
      
      // Réinitialiser le flag après la navigation
      setTimeout(() => {
        prevStateRef.current.isRedirecting = false;
      }, 500);
    }, 50);
  }, []);

  // Vérification unique à l'initialisation et sur les changements importants
  useEffect(() => {
    // Ne rien faire si en cours de chargement ou de redirection
    if (isLoading || !isReady || prevStateRef.current.isRedirecting) {
      return;
    }
    
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
    }
    
    // Ne continuer que si l'état a changé ou c'est la vérification initiale
    if (!initialCheck && !userChanged && !segmentChanged) {
      return;
    }
    
    // Obtenir le groupe de navigation actuel
    const inAuthGroup = currentSegment === '(auth)';
    
    // Logique de redirection
    if (!user && !inAuthGroup) {
      // Rediriger vers login si non connecté et pas déjà sur une page d'auth
      safeNavigate('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Rediriger vers l'app si connecté et sur une page d'auth
      safeNavigate('/(tabs)/stock');
    }
  }, [user, segments, isLoading, isReady, safeNavigate]);

  // Masquer le splash screen une fois le chargement terminé
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
          // Toujours marquer comme prêt, même en cas d'erreur
          setIsReady(true);
        }
      };
      
      hideSplash();
    }
  }, [isLoading]);

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