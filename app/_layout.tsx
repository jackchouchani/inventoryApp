import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { Slot, useRouter, SplashScreen, useSegments } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/config/supabase";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/config/queryClient';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NetworkErrorBoundary } from '../src/components/NetworkErrorBoundary';
import * as Sentry from '@sentry/react-native';
import { subscribeToNetworkChanges } from '../src/utils/networkUtils';
import { DataLoader } from '../src/components/DataLoader';
import { monitoring } from '../src/services/monitoring';

// Empêcher le masquage automatique du splash screen
SplashScreen.preventAutoHideAsync();

// Configuration personnalisée des toasts
const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#4CAF50' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600'
      }}
      text2Style={{
        fontSize: 14
      }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#FF3B30' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '600'
      }}
      text2Style={{
        fontSize: 14
      }}
    />
  )
};

function InitialLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [appIsReady, setAppIsReady] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Gestion du splash screen et de l'état initial
  useEffect(() => {
    async function prepare() {
      try {
        if (!authLoading) {
          setAppIsReady(true);
          await SplashScreen.hideAsync();
        }
      } catch (e) {
        console.error('Erreur lors de la préparation:', e);
        Sentry.captureException(e);
      }
    }

    prepare();
  }, [authLoading]);

  // Protection des routes et redirection
  useEffect(() => {
    if (authLoading || isNavigating || !appIsReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    let targetRoute: string | null = null;

    // Déterminer la route cible
    if (!segments.length || segments[0] === '') {
      targetRoute = user ? '/(tabs)/stock' : '/(auth)/login';
    } else if (!user && !inAuthGroup) {
      targetRoute = '/(auth)/login';
    } else if (user && inAuthGroup) {
      targetRoute = '/(tabs)/stock';
    }

    // Effectuer la redirection si nécessaire
    if (targetRoute) {
      setIsNavigating(true);
      // Utiliser un délai pour s'assurer que le composant est monté
      const timer = setTimeout(() => {
        router.replace(targetRoute as string);
        setIsNavigating(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, segments, authLoading, appIsReady, router]);

  if (!appIsReady || authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return <Slot />;
}

// Initialisation de Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
});

interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const AppErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const isAuthError = error?.message?.includes('auth') || error?.name === 'AuthError';
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isAuthError ? 'Erreur d\'authentification' : 'Oups ! Une erreur est survenue'}
      </Text>
      <Text style={styles.message}>
        {isAuthError 
          ? 'Un problème est survenu avec votre session. Veuillez vous reconnecter.'
          : error?.message || 'Une erreur inattendue s\'est produite'}
      </Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => {
          resetErrorBoundary();
          if (isAuthError) {
            supabase.auth.signOut();
          }
        }}
      >
        <Text style={styles.buttonText}>
          {isAuthError ? 'Se reconnecter' : 'Réessayer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const initApp = async () => {
      try {
        // Initialiser le service de monitoring
        monitoring.setQueryClient(queryClient);

        // Configurer d'abord le listener avant de vérifier la session
        const { data: { subscription } } = await supabase.auth.onAuthStateChange(async (event, _session) => {
          if (event === 'TOKEN_REFRESHED') {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Token refreshed successfully',
              level: 'info'
            });
            // Forcer un rafraîchissement du client React Query
            await queryClient.invalidateQueries();
          } else if (event === 'SIGNED_OUT') {
            queryClient.clear();
            store.dispatch({ type: 'RESET_STATE' });
          } else if (event === 'SIGNED_IN') {
            // Forcer un rafraîchissement des données
            await queryClient.invalidateQueries();
          }
        });

        authSubscription = { data: { subscription } };

        // Ensuite vérifier la session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          // Vérifier si le token a besoin d'être rafraîchi
          const expiresAt = new Date(session.expires_at || '').getTime();
          const now = Date.now();
          if (expiresAt - now < 5 * 60 * 1000) { // 5 minutes
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              throw refreshError;
            }
          }
        }

        setIsLoading(!session);
      } catch (err) {
        console.error("Erreur d'initialisation:", err);
        setError("Erreur lors de l'initialisation de l'application");
        Sentry.captureException(err);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    return () => {
      if (authSubscription?.data.subscription) {
        authSubscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    // Surveillance des changements de connexion réseau
    const unsubscribe = subscribeToNetworkChanges((state) => {
      if (!state.isConnected) {
        Sentry.addBreadcrumb({
          category: 'network',
          message: 'Perte de connexion réseau',
          level: 'warning',
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (isLoading && Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement de l'application...</Text>
        {error && <Text style={styles.errorText}>Erreur: {error}</Text>}
      </View>
    );
  }

  return (
    <ErrorBoundary
      onReset={() => {
        queryClient.clear();
        store.dispatch({ type: 'RESET_STATE' });
        monitoring.clearMetrics();
      }}
      fallbackRender={AppErrorFallback}
    >
      <NetworkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            <AuthProvider>
              <DataLoader>
                <View style={styles.rootContainer}>
                  <InitialLayout />
                </View>
              </DataLoader>
            </AuthProvider>
            <Toast config={toastConfig} />
          </Provider>
        </QueryClientProvider>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
  },
  rootContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorText: {
    color: "red",
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    maxWidth: '80%',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 