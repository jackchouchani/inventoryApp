import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { useSegments, useRouter } from "expo-router";
import { supabase } from "../src/config/supabase";
import Toast, { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '../src/config/queryClient';
import { useInventoryData } from '../src/hooks/useInventoryData';

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

export const unstable_settings = {
  initialRouteName: "(tabs)",
  disableTutorial: true,
  android: {
    navigationBarColor: 'transparent',
    navigationBarStyle: 'dark',
  },
};

export type RootStackParamList = {
  "/(tabs)": undefined;
  "/(auth)/login": undefined;
  "/(stack)/labels": undefined;
  "/(stack)/backup": undefined;
  "/(stack)/categories": undefined;
  "/(stack)/containers": undefined;
  "/(stack)/settings": undefined;
  "/(stack)/stats": undefined;
};

function RootLayoutNav() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refetch: refetchInventory } = useInventoryData();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Précharger les données avant la redirection
      refetchInventory().then(() => {
        router.replace("/(tabs)/stock");
      });
    }
  }, [user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(stack)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const initApp = async () => {
      try {
        // Vérifier si l'application est prête à être utilisée
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace('/(auth)/login');
        }
      } catch (err) {
        console.error("Erreur d'initialisation:", err);
        setError("Erreur lors de l'initialisation de l'application");
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, [router]);

  if (isLoading && Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Chargement des données...</Text>
        {error && <Text style={{ color: "red" }}>Erreur: {error}</Text>}
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <RootLayoutNav />
          </View>
        </AuthProvider>
        <Toast config={toastConfig} />
      </Provider>
    </QueryClientProvider>
  );
} 