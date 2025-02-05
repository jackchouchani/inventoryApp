import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
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
          href: "/stock",
        }}
      />
      
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="qr-code-scanner" size={24} color={color} />
          ),
          href: "/scan",
        }}
      />
      
      <Tabs.Screen
        name="add"
        options={{
          title: "Ajouter",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-circle" size={24} color={color} />
          ),
          href: "/add",
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

