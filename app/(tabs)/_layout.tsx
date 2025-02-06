import React from "react";
import { Tabs } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: { height: 60 },
        tabBarActiveTintColor: '#007AFF',
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/stats')}
              style={{ marginRight: 15 }}
            >
              <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/(stack)/settings')}
              style={{ marginRight: 15 }}
            >
              <MaterialIcons name="settings" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
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
        name="add"
        options={{
          title: "Ajouter",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}