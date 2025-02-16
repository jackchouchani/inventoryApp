import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Slot, useSegments, useRouter } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/config/supabase";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/config/queryClient';

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

function AuthenticationGuard() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/stock");
    }
  }, [user, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoading(!session);
      } catch (err) {
        console.error("Erreur d'initialisation:", err);
        setError("Erreur lors de l'initialisation de l'application");
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
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
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <AuthProvider>
          <View style={styles.rootContainer}>
            <AuthenticationGuard />
          </View>
        </AuthProvider>
        <Toast config={toastConfig} />
      </Provider>
    </QueryClientProvider>
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
}); 