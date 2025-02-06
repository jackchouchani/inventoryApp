import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { initDatabase } from "../src/database/database";
import { initPhotoStorage } from "../src/utils/photoManager";
import { initBackupStorage } from "../src/utils/backupManager";

export const unstable_settings = {
  initialRouteName: "(tabs)",
  disableTutorial: true,
};

export type RootStackParamList = {
  "/(tabs)": undefined;
  "/(auth)/login": undefined;
  "/(stack)/labels": undefined;
  "/(stack)/backup": undefined;
  "/(stack)/categories": undefined;
  "/(stack)/containers": undefined;
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
      router.replace("/(tabs)");
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        await initDatabase();
        if (Platform.OS !== "web") {
          await initPhotoStorage();
          await initBackupStorage();
        }
        setIsInitialized(true);
      } catch (err) {
        console.error("App initialization failed:", err);
        setError("Erreur d'initialisation de l'application");
      }
    };

    initApp();
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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