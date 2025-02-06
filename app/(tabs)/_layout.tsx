import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

