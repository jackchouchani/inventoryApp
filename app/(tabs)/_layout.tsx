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
        headerTitle: "Comptoir Vintage",
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
        },
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#f5f5f5',
          height: 60,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          height: 85,
          paddingBottom: 30,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="stock"
        options={{
          title: "Stock",
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerRight: () => (
            <View style={{ flexDirection: 'row', marginRight: 15 }}>
              <TouchableOpacity
                onPress={() => router.push('/(stack)/stats')}
                style={{ marginRight: 15 }}
              >
                <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(stack)/settings')}
              >
                <MaterialIcons name="settings" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          ),
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