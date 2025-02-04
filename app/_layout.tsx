import React, { useEffect } from "react";
import { Slot } from "expo-router";
import { Provider } from "react-redux";
import { store } from "../src/store/store";
import { initDatabase } from "../src/database/database";
import { initPhotoStorage } from "../src/utils/photoManager";
import { initBackupStorage } from "../src/utils/backupManager";

export default function RootLayout() {
  useEffect(() => {
    const initApp = async () => {
      try {
        await initDatabase();
        await initPhotoStorage();
        await initBackupStorage();
        console.log("App initialized successfully");
      } catch (error) {
        console.error("App initialization failed:", error);
      }
    };

    initApp();
  }, []);

  return (
    <Provider store={store}>
      <Slot />
    </Provider>
  );
} 