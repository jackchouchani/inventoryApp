import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { useSegments, useRouter } from "expo-router";
import { supabase } from "../src/config/supabase";
import { StatusBar } from 'expo-status-bar';

export const unstable_settings = {
  initialRouteName: "(tabs)",
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

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/stock"); // Redirection vers la page stock spécifiquement
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
      <View style={styles.container}>
        <Text>Chargement des données...</Text>
        {error && <Text style={{ color: "red" }}>Erreur: {error}</Text>}
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
  },
  rootContainer: {
    flex: 1,
  },
  stackContentStyle: {
    backgroundColor: "#fff",
  },
}); 