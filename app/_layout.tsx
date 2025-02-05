import React, { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { initDatabase } from "../src/database/database";
import { initPhotoStorage } from "../src/utils/photoManager";
import { initBackupStorage } from "../src/utils/backupManager";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  console.log("RootLayout mounting...");
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("RootLayout useEffect running...");
    const initApp = async () => {
      try {
        console.log("Starting app initialization...");
        await initDatabase().catch((error) => {
            console.error('Database init error:', error);
            throw error;
        });
        
        if (Platform.OS !== 'web') {
          console.log("Initializing native features...");
          await initPhotoStorage();
          await initBackupStorage();
        }
        
        setIsInitialized(true);
        console.log("App initialized successfully");
      } catch (error) {
        console.error("App initialization failed:", error);
        setError("Erreur d'initialisation de l'application");
      }
    };

    initApp();
  }, []);

  if (!isInitialized) {
    console.log("Rendering loading state...");
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Chargement des données...</Text>
        {error && <Text style={{ color: 'red' }}>Erreur: {error}</Text>}
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log("Rendering main app layout...");
  return (
    <Provider store={store}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="(stack)"
          options={{ headerShown: false }}
        />
      </Stack>
    </Provider>
  );
} 