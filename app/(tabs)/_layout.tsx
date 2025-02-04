import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { Slot, Tabs, useRouter } from "expo-router";
import { store } from "../../src/store/store";
import { initDatabase } from "../../src/database/database";
import { initPhotoStorage } from "../../src/utils/photoManager";
import { initBackupStorage } from "../../src/utils/backupManager";
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

export default function TabsLayout() {
  const router = useRouter();

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
      <Tabs
        screenOptions={{
          tabBarStyle: { height: 60 },
          tabBarActiveTintColor: '#007AFF',
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/settings')}
              style={{ marginRight: 15 }}
            >
              <MaterialIcons name="settings" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/stats')}
              style={{ marginLeft: 15 }}
            >
              <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="stock"
          options={{
            title: "Stock",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="inventory" size={24} color={color} />
            ),
          }}
        />
        
        <Tabs.Screen
          name="scan"
          options={{
            title: "",
            tabBarIcon: ({ color }) => (
              <View style={styles.scanButton}>
                <MaterialIcons name="qr-code-scanner" size={32} color={color} />
              </View>
            ),
          }}
        />
        
        <Tabs.Screen
          name="add"
          options={{
            title: "Add",
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="add-circle" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </Provider>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    backgroundColor: '#fff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }
});
